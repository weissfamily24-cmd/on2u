-- =============================================================================
-- ON2U Eats — DEMO-DATEN. NUR FÜR LOKALE ENTWICKLUNG (`npx supabase db reset`).
-- NIE IN DIE PRODUKTIV-DB. Die fünf Lokale entsprechen lib/demo/places.ts.
-- Namen, Adressen, Preise und Bewertungen sind erfunden.
--
-- Feste UUIDs, damit das Frontend lokal stabile Links hat:
--   Demo-Inhaber  d0000000-0000-4000-8000-000000000001  (demo-inhaber@on2u.local)
--   Demo-Gast     d0000000-0000-4000-8000-000000000002  (demo-gast@on2u.local)
--   Lokale        a0000000-0000-4000-8000-00000000000{1..5}
--
-- Anmeldung lokal: Magic Link an eine der beiden Adressen schicken, Mail in
-- Inbucket öffnen (`npx supabase status` zeigt die URL). Das Passwort
-- "on2u-demo" ist nur gesetzt, damit GoTrue keine Null-Spalten sieht.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Demo-Nutzer in auth.users + auth.identities (Muster aus den Supabase-Docs für
-- lokale Seeds; die Token-Spalten müssen '' statt null sein, sonst scheitert GoTrue)
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  is_sso_user
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'd0000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'demo-inhaber@on2u.local',
    extensions.crypt('on2u-demo', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"demo":true,"name":"Demo-Inhaber"}'::jsonb,
    now(), now(), now(),
    '', '', '', '', '', '', '', '',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'd0000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'demo-gast@on2u.local',
    extensions.crypt('on2u-demo', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"demo":true,"name":"Demo-Gast"}'::jsonb,
    now(), now(), now(),
    '', '', '', '', '', '', '', '',
    false
  )
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values
  (
    gen_random_uuid(),
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    '{"sub":"d0000000-0000-4000-8000-000000000001","email":"demo-inhaber@on2u.local","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    gen_random_uuid(),
    'd0000000-0000-4000-8000-000000000002',
    'd0000000-0000-4000-8000-000000000002',
    '{"sub":"d0000000-0000-4000-8000-000000000002","email":"demo-gast@on2u.local","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  )
on conflict (provider_id, provider) do nothing;

-- -----------------------------------------------------------------------------
-- Lokale (DEMO) — Koordinaten Bamberg, wie in lib/demo/places.ts
-- -----------------------------------------------------------------------------
insert into public.places (id, owner_id, name, category, lat, lng, address, caption)
values
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Zur alten Fähre', 'Fränkisch', 49.8925, 10.8858, 'Kapuzinerstraße 12',
   'Heute Schäufele mit Kloß, solange es reicht.'),
  ('a0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001',
   'Café Obstmarkt', 'Café', 49.8937, 10.8869, 'Obstmarkt 3',
   'Zimtschnecken kommen um 9 aus dem Ofen.'),
  ('a0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001',
   'Trattoria Regnitz', 'Italienisch', 49.8915, 10.8830, 'Am Kranen 8',
   'Pizza am Wasser.'),
  ('a0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001',
   'Bar Hain', 'Bar', 49.8840, 10.8930, 'Hainstraße 41',
   'Donnerstag: Negroni-Abend.'),
  ('a0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001',
   'Kebab Kettenbrücke', 'Imbiss', 49.8950, 10.8880, 'Kettenbrückstraße 2',
   null);

-- -----------------------------------------------------------------------------
-- Speisekarten (DEMO-Preise)
-- -----------------------------------------------------------------------------
insert into public.menu_items (place_id, name, description, price_cents, currency, position)
values
  ('a0000000-0000-4000-8000-000000000001', 'Schäufele mit Kloß', 'Kruste, Biersoße', 1490, 'EUR', 0),
  ('a0000000-0000-4000-8000-000000000001', 'Rauchbier 0,5 l', 'vom Fass', 390, 'EUR', 1),
  ('a0000000-0000-4000-8000-000000000001', 'Bratwurst, 3 Stück', 'mit Kraut', 950, 'EUR', 2),
  ('a0000000-0000-4000-8000-000000000002', 'Cappuccino', 'Hafer +0,50', 360, 'EUR', 0),
  ('a0000000-0000-4000-8000-000000000002', 'Zimtschnecke', 'hausgemacht', 380, 'EUR', 1),
  ('a0000000-0000-4000-8000-000000000003', 'Margherita', 'San-Marzano, Fior di Latte', 1050, 'EUR', 0),
  ('a0000000-0000-4000-8000-000000000004', 'Negroni', null, 850, 'EUR', 0),
  ('a0000000-0000-4000-8000-000000000004', 'Spritz', 'Aperol oder Limoncello', 750, 'EUR', 1),
  ('a0000000-0000-4000-8000-000000000005', 'Döner', null, 700, 'EUR', 0);

-- -----------------------------------------------------------------------------
-- QR-Tokens (DEMO). Zwei feste Tokens zum Testen der Edge Function verify-qr:
--   DEMOtoken0000000000001 → Zur alten Fähre, Tisch 1
--   DEMOtoken0000000000002 → Bar Hain, Tisch 1
-- Lokal testen: http://localhost:5173/scan?t=DEMOtoken0000000000001
-- Die übrigen Tokens werden von der DB erzeugt (generate_qr_token()).
-- -----------------------------------------------------------------------------
insert into public.qr_tokens (place_id, token, table_label)
values
  ('a0000000-0000-4000-8000-000000000001', 'DEMOtoken0000000000001', 'Tisch 1'),
  ('a0000000-0000-4000-8000-000000000004', 'DEMOtoken0000000000002', 'Tisch 1');

insert into public.qr_tokens (place_id, table_label)
select p.id, 'Tisch ' || n
from public.places p
cross join generate_series(2, 4) as n
where p.id in (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000004'
);

-- -----------------------------------------------------------------------------
-- Besuche (DEMO) — der Demo-Gast hat zwei Lokale besucht
-- -----------------------------------------------------------------------------
insert into public.visits (id, place_id, user_id, qr_token, table_label, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000002', 'DEMOtoken0000000000001', 'Tisch 1',
   now() - interval '3 days'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004',
   'd0000000-0000-4000-8000-000000000002', 'DEMOtoken0000000000002', 'Tisch 1',
   now() - interval '1 day');

-- -----------------------------------------------------------------------------
-- Bewertungen (DEMO) — genau eine pro Besuch
-- -----------------------------------------------------------------------------
insert into public.reviews (id, visit_id, place_id, user_id, hearts, tags, created_at)
values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
   5, array['Schäufele', 'freundlich'], now() - interval '3 days'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000002',
   5, array['Negroni', 'gemütlich'], now() - interval '1 day');

-- -----------------------------------------------------------------------------
-- Bestätigungen (DEMO) — Zeitpunkte wie in lib/demo/places.ts
--   Zur alten Fähre: Inhaber vor 2 Tagen + Gast vor 3 Tagen  → grün
--   Café Obstmarkt:  Inhaber vor 5 Tagen                      → grün
--   Trattoria:       Inhaber vor 95 Tagen                     → gelb (zu alt)
--   Bar Hain:        Gast vor 1 Tag                           → grün
--   Kebab:           keine                                    → gelb
-- -----------------------------------------------------------------------------
insert into public.menu_confirmations (place_id, "by", user_id, visit_id, prices_match, created_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'owner', 'd0000000-0000-4000-8000-000000000001',
   null, true, now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000001', 'guest', 'd0000000-0000-4000-8000-000000000002',
   'b0000000-0000-4000-8000-000000000001', true, now() - interval '3 days'),
  ('a0000000-0000-4000-8000-000000000002', 'owner', 'd0000000-0000-4000-8000-000000000001',
   null, true, now() - interval '5 days'),
  ('a0000000-0000-4000-8000-000000000003', 'owner', 'd0000000-0000-4000-8000-000000000001',
   null, true, now() - interval '95 days'),
  ('a0000000-0000-4000-8000-000000000004', 'guest', 'd0000000-0000-4000-8000-000000000002',
   'b0000000-0000-4000-8000-000000000002', true, now() - interval '1 day');

-- Keine Demo-Videos: es gibt keine Dateien im lokalen Bucket, leere Pfade
-- würden im Feed nur kaputte Player zeigen.
