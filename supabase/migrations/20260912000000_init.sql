-- =============================================================================
-- ON2U Eats — Initiale Migration (Schritt 1)
-- Quelle: docs/schema-contract.md (verbindlich), CLAUDE.md (Frische-Regel)
--
-- Enthält: Erweiterungen, Tabellen, Indizes, RLS, View place_freshness,
-- RPCs (submit_review, confirm_menu, create_qr_tokens, replace_menu),
-- Storage-Buckets (videos, menu-photos) samt Policies.
--
-- Grundsatz: Lesen ohne Konto, Schreiben nur mit Konto. Gäste schreiben
-- visits/reviews/menu_confirmations NIE direkt, nur über RPC/Edge Function.
-- Keine Bewertung ohne visit — erzwungen per FK + RPC.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Erweiterungen
-- -----------------------------------------------------------------------------
-- pgcrypto liefert gen_random_bytes() für die QR-Tokens. In Supabase liegt die
-- Erweiterung im Schema "extensions" (lokal und in der Cloud bereits aktiv).
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Hilfsfunktionen
-- -----------------------------------------------------------------------------

-- Erzeugt einen URL-sicheren Token: 16 Zufallsbytes → base64url, 22 Zeichen.
create or replace function public.generate_qr_token()
returns text
language sql
volatile
set search_path = public
as $$
  select left(
    rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '='),
    22
  );
$$;

-- Liest die place_id aus dem ersten Pfadsegment eines Storage-Objekts
-- ("{place_id}/{uuid}.{ext}"). Gibt null zurück, wenn das Segment keine UUID ist,
-- damit Policies keinen Cast-Fehler werfen.
create or replace function public.storage_path_place_id(p_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when split_part(p_name, '/', 1)
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
    else null
  end;
$$;

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------

-- Lokale. Wer ein Lokal anlegt, ist dessen Inhaber (owner_id = auth.uid()).
create table public.places (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  category    text,                          -- z. B. 'Fränkisch', 'Café', 'Italienisch', 'Bar', 'Imbiss'
  lat         double precision not null,
  lng         double precision not null,
  address     text not null,
  caption     text,                          -- ein Satz, optional (Lora Italic im UI)
  created_at  timestamptz not null default now(),
  constraint places_name_not_blank check (length(trim(name)) > 0),
  constraint places_lat_range check (lat between -90 and 90),
  constraint places_lng_range check (lng between -180 and 180)
);

create index places_owner_id_idx on public.places (owner_id);
create index places_created_at_idx on public.places (created_at desc);

-- Ist der eingeloggte Nutzer Inhaber des Lokals? (null → false)
-- security definer, damit die Prüfung unabhängig von künftigen RLS-Änderungen
-- an "places" funktioniert. Nur lesend, kein Risiko.
-- Steht hier (nach "places"), weil SQL-Funktionen beim Anlegen geprüft werden.
create or replace function public.is_place_owner(p_place_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.places p
    where p.id = p_place_id
      and p.owner_id = auth.uid()
  );
$$;

-- Gerichte / Getränke einer Speisekarte.
create table public.menu_items (
  id           uuid primary key default gen_random_uuid(),
  place_id     uuid not null references public.places (id) on delete cascade,
  name         text not null,
  description  text,
  price_cents  integer not null,
  currency     text not null default 'EUR',
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint menu_items_name_not_blank check (length(trim(name)) > 0),
  constraint menu_items_price_nonnegative check (price_cents >= 0),
  constraint menu_items_currency check (currency in ('EUR', 'ALL'))
);

create index menu_items_place_id_position_idx on public.menu_items (place_id, position);
create index menu_items_created_at_idx on public.menu_items (created_at desc);

-- Foto der Speisekarte (Schritt 1: nur speichern und anzeigen, keine OCR).
create table public.menu_photos (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references public.places (id) on delete cascade,
  path        text not null,                 -- Pfad im Bucket "menu-photos"
  created_at  timestamptz not null default now()
);

create index menu_photos_place_id_idx on public.menu_photos (place_id);
create index menu_photos_created_at_idx on public.menu_photos (created_at desc);

-- Ein Token pro Tisch. Wird beim QR-Druck erzeugt (RPC create_qr_tokens).
-- QR-Inhalt: {APP_URL}/scan?t={token}
create table public.qr_tokens (
  id           uuid primary key default gen_random_uuid(),
  place_id     uuid not null references public.places (id) on delete cascade,
  token        text not null unique default public.generate_qr_token(),
  table_label  text,                         -- z. B. 'Tisch 3'
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint qr_tokens_token_length check (length(token) = 22)
);

create index qr_tokens_place_id_idx on public.qr_tokens (place_id);
create index qr_tokens_created_at_idx on public.qr_tokens (created_at desc);

-- Besuche. Nur über die Edge Function verify-qr (Service Role) anlegbar.
create table public.visits (
  id           uuid primary key default gen_random_uuid(),
  place_id     uuid not null references public.places (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  qr_token     text not null,                -- der gescannte Token
  table_label  text,                         -- Kopie aus qr_tokens
  created_at   timestamptz not null default now()
);

create index visits_place_id_idx on public.visits (place_id);
create index visits_user_place_created_idx on public.visits (user_id, place_id, created_at desc);
create index visits_created_at_idx on public.visits (created_at desc);

-- Bewertungen. Nur über RPC submit_review. Genau eine pro Besuch.
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid not null unique references public.visits (id) on delete cascade,
  place_id    uuid not null references public.places (id) on delete cascade,  -- denormalisiert fürs Lesen
  user_id     uuid not null references auth.users (id) on delete cascade,
  hearts      smallint not null,
  tags        text[] not null default '{}',
  video_path  text,                          -- optional, Pfad im Bucket "videos"
  created_at  timestamptz not null default now(),
  constraint reviews_hearts_range check (hearts between 1 and 5)
);

create index reviews_place_id_idx on public.reviews (place_id);
create index reviews_user_id_idx on public.reviews (user_id);
create index reviews_created_at_idx on public.reviews (created_at desc);

-- Bestätigungen der Speisekarte. Grundlage für den grünen Punkt.
-- Inhaber: über RPC confirm_menu (visit_id null). Gast: über RPC submit_review.
create table public.menu_confirmations (
  id            uuid primary key default gen_random_uuid(),
  place_id      uuid not null references public.places (id) on delete cascade,
  "by"          text not null,
  user_id       uuid not null references auth.users (id) on delete cascade,
  visit_id      uuid references public.visits (id) on delete cascade,
  prices_match  boolean not null,
  created_at    timestamptz not null default now(),
  constraint menu_confirmations_by check ("by" in ('owner', 'guest')),
  constraint menu_confirmations_visit_by_role check (
    ("by" = 'owner' and visit_id is null) or ("by" = 'guest' and visit_id is not null)
  )
);

create index menu_confirmations_place_created_idx on public.menu_confirmations (place_id, created_at desc);
create index menu_confirmations_visit_id_idx on public.menu_confirmations (visit_id);

-- Videos. Inhaber laden direkt hoch (by='owner'), Gäste nur über submit_review.
create table public.videos (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references public.places (id) on delete cascade,
  "by"        text not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  review_id   uuid references public.reviews (id) on delete cascade,
  path        text not null,                 -- Pfad im Bucket "videos"
  caption     text,
  created_at  timestamptz not null default now(),
  constraint videos_by check ("by" in ('owner', 'guest')),
  constraint videos_review_by_role check (
    ("by" = 'owner' and review_id is null) or ("by" = 'guest' and review_id is not null)
  )
);

create index videos_place_id_idx on public.videos (place_id);
create index videos_created_at_idx on public.videos (created_at desc);

-- -----------------------------------------------------------------------------
-- View place_freshness — die Frische-Regel in SQL (Spiegel von lib/data/freshness.ts)
-- is_fresh = ≥ 1 Bestätigung in 7 Tagen UND < 3 prices_match=false in 7 Tagen.
-- Läuft mit den Rechten des View-Eigentümers (kein security_invoker), damit
-- anon sie ohne Umwege lesen kann.
-- -----------------------------------------------------------------------------
create view public.place_freshness
with (security_invoker = false)
as
with conf as (
  select
    mc.place_id,
    max(mc.created_at)                                                    as last_confirmed_at,
    count(*) filter (where mc.created_at >= now() - interval '7 days')    as confirmations_7d,
    count(*) filter (where mc.created_at >= now() - interval '7 days'
                       and mc.prices_match = false)                       as mismatches_7d,
    bool_or(mc."by" = 'owner'
            and mc.created_at >= now() - interval '7 days')               as owner_confirmed_7d,
    count(distinct mc.user_id) filter (where mc."by" = 'guest'
                       and mc.created_at >= now() - interval '7 days')    as guest_confirmers_7d
  from public.menu_confirmations mc
  group by mc.place_id
),
rev as (
  select
    r.place_id,
    avg(r.hearts) as avg_hearts,
    count(*)      as review_count
  from public.reviews r
  group by r.place_id
)
select
  p.id                                                                    as place_id,
  (coalesce(c.confirmations_7d, 0) >= 1 and coalesce(c.mismatches_7d, 0) < 3) as is_fresh,
  c.last_confirmed_at                                                     as last_confirmed_at,
  coalesce(c.confirmations_7d, 0)::integer                                as confirmations_7d,
  coalesce(c.mismatches_7d, 0)::integer                                   as mismatches_7d,
  coalesce(c.owner_confirmed_7d, false)                                   as owner_confirmed_7d,
  coalesce(c.guest_confirmers_7d, 0)::integer                             as guest_confirmers_7d,
  round(r.avg_hearts, 2)::numeric(3, 2)                                   as avg_hearts,
  coalesce(r.review_count, 0)::integer                                    as review_count
from public.places p
left join conf c on c.place_id = p.id
left join rev  r on r.place_id = p.id;

-- -----------------------------------------------------------------------------
-- RPCs (security definer, search_path = public, deutsche Fehlertexte)
-- -----------------------------------------------------------------------------

-- Bewertung abgeben: reviews + menu_confirmations (+ videos) in EINER Transaktion.
create or replace function public.submit_review(
  p_visit_id      uuid,
  p_hearts        smallint,
  p_prices_match  boolean,
  p_tags          text[],
  p_video_path    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_visit      public.visits%rowtype;
  v_review_id  uuid;
  v_video      text := nullif(trim(coalesce(p_video_path, '')), '');
begin
  if v_uid is null then
    raise exception 'Bitte melde dich an, um zu bewerten.';
  end if;

  -- Besuch gehört dem Nutzer? Zeile sperren, damit zwei parallele Aufrufe
  -- nicht beide durchkommen (die unique-Constraint auf visit_id fängt den Rest).
  select * into v_visit
  from public.visits v
  where v.id = p_visit_id and v.user_id = v_uid
  for update;

  if not found then
    raise exception 'Besuch nicht gefunden.';
  end if;

  if exists (select 1 from public.reviews r where r.visit_id = p_visit_id) then
    raise exception 'Für diesen Besuch hast du schon bewertet.';
  end if;

  if p_hearts is null or p_hearts < 1 or p_hearts > 5 then
    raise exception 'Bitte 1 bis 5 Herzen vergeben.';
  end if;

  if p_prices_match is null then
    raise exception 'Bitte sag uns, ob die Preise stimmen.';
  end if;

  insert into public.reviews (visit_id, place_id, user_id, hearts, tags, video_path)
  values (p_visit_id, v_visit.place_id, v_uid, p_hearts, coalesce(p_tags, '{}'), v_video)
  returning id into v_review_id;

  insert into public.menu_confirmations (place_id, "by", user_id, visit_id, prices_match)
  values (v_visit.place_id, 'guest', v_uid, p_visit_id, p_prices_match);

  if v_video is not null then
    insert into public.videos (place_id, "by", user_id, review_id, path)
    values (v_visit.place_id, 'guest', v_uid, v_review_id, v_video);
  end if;

  return v_review_id;
end;
$$;

-- Inhaber bestätigt seine Speisekarte (prices_match = true).
create or replace function public.confirm_menu(p_place_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Bitte melde dich an.';
  end if;

  if not public.is_place_owner(p_place_id) then
    raise exception 'Nur der Inhaber kann die Speisekarte bestätigen.';
  end if;

  insert into public.menu_confirmations (place_id, "by", user_id, visit_id, prices_match)
  values (p_place_id, 'owner', auth.uid(), null, true)
  returning id into v_id;

  return v_id;
end;
$$;

-- Erzeugt p_count QR-Tokens ('Tisch n', fortlaufend ab der nächsten freien Nummer).
create or replace function public.create_qr_tokens(p_place_id uuid, p_count integer)
returns setof public.qr_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if auth.uid() is null then
    raise exception 'Bitte melde dich an.';
  end if;

  if not public.is_place_owner(p_place_id) then
    raise exception 'Nur der Inhaber kann QR-Codes erzeugen.';
  end if;

  if p_count is null or p_count < 1 or p_count > 100 then
    raise exception 'Bitte 1 bis 100 Tische angeben.';
  end if;

  -- Nächste freie Tischnummer: höchste vorhandene 'Tisch n' + 1.
  select coalesce(max((regexp_match(q.table_label, '^Tisch (\d+)$'))[1]::integer), 0) + 1
  into v_next
  from public.qr_tokens q
  where q.place_id = p_place_id;

  -- Data-modifying CTE, damit RETURN QUERY ein normales SELECT bekommt.
  return query
    with ins as (
      insert into public.qr_tokens (place_id, token, table_label)
      select p_place_id, public.generate_qr_token(), 'Tisch ' || s.n
      from generate_series(v_next, v_next + p_count - 1) as s (n)
      returning *
    )
    select * from ins
    order by (regexp_match(table_label, '(\d+)$'))[1]::integer;
end;
$$;

-- Ersetzt die komplette Speisekarte eines Lokals in einer Transaktion.
-- p_items = [{ "name", "description", "price_cents", "currency" }], Reihenfolge = position.
create or replace function public.replace_menu(p_place_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Bitte melde dich an.';
  end if;

  if not public.is_place_owner(p_place_id) then
    raise exception 'Nur der Inhaber kann die Speisekarte ändern.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Speisekarte muss eine Liste sein.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as e (item)
    where length(trim(coalesce(e.item ->> 'name', ''))) = 0
  ) then
    raise exception 'Jedes Gericht braucht einen Namen.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as e (item)
    where (e.item ->> 'price_cents') is null
  ) then
    raise exception 'Jedes Gericht braucht einen Preis.';
  end if;

  delete from public.menu_items where place_id = p_place_id;

  insert into public.menu_items (place_id, name, description, price_cents, currency, position)
  select
    p_place_id,
    trim(e.item ->> 'name'),
    nullif(trim(coalesce(e.item ->> 'description', '')), ''),
    round((e.item ->> 'price_cents')::numeric)::integer,
    coalesce(nullif(e.item ->> 'currency', ''), 'EUR'),
    (e.ord - 1)::integer
  from jsonb_array_elements(p_items) with ordinality as e (item, ord);
end;
$$;

-- -----------------------------------------------------------------------------
-- Rechte: Tabellen, View, Funktionen
-- Supabase vergibt per Default-Privilegien ALL an anon/authenticated. Wir nehmen
-- das zurück und geben genau das, was der Vertrag erlaubt. RLS bleibt die
-- eigentliche Sperre; die Grants sind der zweite Riegel.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- Öffentlich lesbar (mit und ohne Konto)
grant select on public.places, public.menu_items, public.menu_photos,
                public.menu_confirmations, public.reviews, public.videos,
                public.place_freshness
  to anon, authenticated;

-- Nur mit Konto lesbar (per RLS weiter eingeschränkt)
grant select on public.qr_tokens, public.visits to authenticated;

-- Inhaber-Schreibrechte (per RLS auf eigene Lokale beschränkt)
grant insert, update, delete on public.places, public.menu_items, public.menu_photos,
                                public.qr_tokens, public.videos
  to authenticated;

-- Funktionen: RPCs nur für authenticated (+ service_role), Hilfsfunktionen für Policies.
revoke execute on function public.submit_review(uuid, smallint, boolean, text[], text) from public, anon;
revoke execute on function public.confirm_menu(uuid) from public, anon;
revoke execute on function public.create_qr_tokens(uuid, integer) from public, anon;
revoke execute on function public.replace_menu(uuid, jsonb) from public, anon;

grant execute on function public.submit_review(uuid, smallint, boolean, text[], text) to authenticated, service_role;
grant execute on function public.confirm_menu(uuid) to authenticated, service_role;
grant execute on function public.create_qr_tokens(uuid, integer) to authenticated, service_role;
grant execute on function public.replace_menu(uuid, jsonb) to authenticated, service_role;

grant execute on function public.is_place_owner(uuid) to anon, authenticated, service_role;
grant execute on function public.storage_path_place_id(text) to anon, authenticated, service_role;
grant execute on function public.generate_qr_token() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.places             enable row level security;
alter table public.menu_items         enable row level security;
alter table public.menu_photos        enable row level security;
alter table public.qr_tokens          enable row level security;
alter table public.visits             enable row level security;
alter table public.reviews            enable row level security;
alter table public.menu_confirmations enable row level security;
alter table public.videos             enable row level security;

-- places: alle lesen; Inhaber schreibt eigene Lokale
create policy "places: öffentlich lesbar"
  on public.places for select
  to anon, authenticated
  using (true);

create policy "places: Inhaber legt eigenes Lokal an"
  on public.places for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "places: Inhaber ändert eigenes Lokal"
  on public.places for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "places: Inhaber löscht eigenes Lokal"
  on public.places for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- menu_items: alle lesen; Inhaber schreibt
create policy "menu_items: öffentlich lesbar"
  on public.menu_items for select
  to anon, authenticated
  using (true);

create policy "menu_items: Inhaber fügt hinzu"
  on public.menu_items for insert
  to authenticated
  with check (public.is_place_owner(place_id));

create policy "menu_items: Inhaber ändert"
  on public.menu_items for update
  to authenticated
  using (public.is_place_owner(place_id))
  with check (public.is_place_owner(place_id));

create policy "menu_items: Inhaber löscht"
  on public.menu_items for delete
  to authenticated
  using (public.is_place_owner(place_id));

-- menu_photos: alle lesen; Inhaber schreibt
create policy "menu_photos: öffentlich lesbar"
  on public.menu_photos for select
  to anon, authenticated
  using (true);

create policy "menu_photos: Inhaber fügt hinzu"
  on public.menu_photos for insert
  to authenticated
  with check (public.is_place_owner(place_id));

create policy "menu_photos: Inhaber ändert"
  on public.menu_photos for update
  to authenticated
  using (public.is_place_owner(place_id))
  with check (public.is_place_owner(place_id));

create policy "menu_photos: Inhaber löscht"
  on public.menu_photos for delete
  to authenticated
  using (public.is_place_owner(place_id));

-- qr_tokens: NICHT öffentlich. Nur Inhaber des Lokals sieht und verwaltet sie.
create policy "qr_tokens: Inhaber liest"
  on public.qr_tokens for select
  to authenticated
  using (public.is_place_owner(place_id));

create policy "qr_tokens: Inhaber fügt hinzu"
  on public.qr_tokens for insert
  to authenticated
  with check (public.is_place_owner(place_id));

create policy "qr_tokens: Inhaber ändert"
  on public.qr_tokens for update
  to authenticated
  using (public.is_place_owner(place_id))
  with check (public.is_place_owner(place_id));

create policy "qr_tokens: Inhaber löscht"
  on public.qr_tokens for delete
  to authenticated
  using (public.is_place_owner(place_id));

-- visits: Nutzer sieht nur eigene Besuche. Kein direktes Schreiben
-- (nur Edge Function verify-qr mit Service Role).
create policy "visits: eigene Besuche lesen"
  on public.visits for select
  to authenticated
  using (user_id = (select auth.uid()));

-- reviews: alle lesen. Kein direktes Schreiben (nur RPC submit_review).
create policy "reviews: öffentlich lesbar"
  on public.reviews for select
  to anon, authenticated
  using (true);

-- menu_confirmations: alle lesen. Kein direktes Schreiben (nur RPCs).
create policy "menu_confirmations: öffentlich lesbar"
  on public.menu_confirmations for select
  to anon, authenticated
  using (true);

-- videos: alle lesen; Inhaber schreibt eigene Inhaber-Videos (by='owner').
-- Gast-Videos entstehen nur über submit_review.
create policy "videos: öffentlich lesbar"
  on public.videos for select
  to anon, authenticated
  using (true);

create policy "videos: Inhaber fügt eigenes Video hinzu"
  on public.videos for insert
  to authenticated
  with check (
    "by" = 'owner'
    and user_id = (select auth.uid())
    and public.is_place_owner(place_id)
  );

create policy "videos: Inhaber ändert eigenes Video"
  on public.videos for update
  to authenticated
  using ("by" = 'owner' and public.is_place_owner(place_id))
  with check ("by" = 'owner' and user_id = (select auth.uid()) and public.is_place_owner(place_id));

create policy "videos: Inhaber löscht eigenes Video"
  on public.videos for delete
  to authenticated
  using ("by" = 'owner' and public.is_place_owner(place_id));

-- -----------------------------------------------------------------------------
-- Storage: Buckets und Policies
-- videos:      öffentlich lesbar, Upload für angemeldete Nutzer, 50 MB, Video-MIME
-- menu-photos: öffentlich lesbar, Upload nur Inhaber (Pfad beginnt mit eigener place_id), 10 MB, image/*
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('videos',      'videos',      true, 52428800, array['video/mp4', 'video/quicktime', 'video/webm']),
  ('menu-photos', 'menu-photos', true, 10485760, array['image/*'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Öffentliches Lesen beider Buckets
create policy "storage: videos öffentlich lesbar"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'videos');

create policy "storage: menu-photos öffentlich lesbar"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'menu-photos');

-- videos: jeder angemeldete Nutzer darf hochladen
create policy "storage: videos Upload für Angemeldete"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'videos');

-- menu-photos: nur Inhaber des Lokals, Pfad "{place_id}/..."
create policy "storage: menu-photos Upload nur Inhaber"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'menu-photos'
    and public.is_place_owner(public.storage_path_place_id(name))
  );

create policy "storage: menu-photos Löschen nur Inhaber"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'menu-photos'
    and public.is_place_owner(public.storage_path_place_id(name))
  );
