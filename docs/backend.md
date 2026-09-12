# Backend (Supabase) — Stand 12.09.2026

Umsetzung von `docs/schema-contract.md` (verbindlich). Dieses Dokument sagt, was existiert, wie man es lokal startet, wie es in ein Supabase-Projekt kommt und was noch offen ist.

## Was existiert

| Datei | Inhalt |
|---|---|
| `supabase/migrations/20260912000000_init.sql` | Komplettes Schema: Erweiterung `pgcrypto`, Tabellen `places`, `menu_items`, `menu_photos`, `qr_tokens`, `visits`, `reviews`, `menu_confirmations`, `videos` mit Constraints und Indizes; View `place_freshness`; RPCs `submit_review`, `confirm_menu`, `create_qr_tokens`, `replace_menu`; Grants; RLS-Policies für alle Tabellen; Storage-Buckets `videos` (50 MB, mp4/quicktime/webm) und `menu-photos` (10 MB, image/*) samt `storage.objects`-Policies. |
| `supabase/seed.sql` | **Demo-Daten, nur lokal.** Zwei Demo-Nutzer in `auth.users` (Inhaber und Gast), die fünf Bamberger Demo-Lokale aus `lib/demo/places.ts` mit Speisekarten, QR-Tokens, zwei Besuchen, zwei Bewertungen und Bestätigungen, sodass drei Lokale grün und zwei gelb sind. |
| `supabase/functions/verify-qr/index.ts` | Edge Function (Deno). Prüft das Nutzer-JWT selbst, schlägt den Token mit Service Role nach, legt den `visit` an. Antworten 200/401/404/429 exakt wie im Vertrag, CORS inklusive OPTIONS. |
| `supabase/functions/verify-qr/deno.json` | Import-Map: `@supabase/supabase-js` → `npm:@supabase/supabase-js@2`. |
| `supabase/config.toml` | Angepasst: `site_url = "http://localhost:5173"`, `additional_redirect_urls = ["http://localhost:5173/auth/callback"]`, `[functions.verify-qr] verify_jwt = false`. E-Mail-Signup (Magic Link) war bereits an, Storage-Limit bereits `50MiB`. Rest Default. |

### Die Frische-Regel in SQL

`place_freshness` spiegelt `lib/data/freshness.ts`: `is_fresh = confirmations_7d >= 1 and mismatches_7d < 3`. Fenster: `created_at >= now() - interval '7 days'`. Dazu `last_confirmed_at`, `owner_confirmed_7d`, `guest_confirmers_7d` (verschiedene Gäste), `avg_hearts` (numeric(3,2), null ohne Reviews), `review_count`. Die View läuft ohne `security_invoker`, `anon` darf sie lesen.

### Rechte-Modell in Kürze

- Ohne Konto lesbar: `places`, `menu_items`, `menu_photos`, `menu_confirmations`, `reviews`, `videos`, `place_freshness`.
- `qr_tokens`: nur Inhaber des Lokals (lesen und schreiben). `visits`: nur eigene Zeilen lesen, kein direktes Schreiben.
- Inhaber (`places.owner_id = auth.uid()`, geprüft über `is_place_owner()`) schreiben eigene `places`, `menu_items`, `menu_photos`, `qr_tokens` und Inhaber-Videos (`by = 'owner'`).
- `reviews`, `menu_confirmations`, Gast-Videos und `visits` entstehen **nur** über die RPCs (`security definer`) bzw. die Edge Function (Service Role). Kein Insert-Policy dafür.
- RPCs sind nur für `authenticated` (und `service_role`) ausführbar; `anon` bekommt „permission denied“.
- Zusätzlich zu RLS sind die Tabellen-Grants für `anon`/`authenticated` auf genau das Nötige reduziert (zweiter Riegel).

### QR-Token

`generate_qr_token()`: 16 Zufallsbytes (`pgcrypto`) → base64url → 22 Zeichen. Ist Default der Spalte `qr_tokens.token`, Check-Constraint `length(token) = 22`. `create_qr_tokens(p_place_id, p_count)` nummeriert ab der höchsten vorhandenen „Tisch n“ weiter, max. 100 pro Aufruf. QR-Inhalt: `{APP_URL}/scan?t={token}`.

## Lokal starten

Voraussetzung: **Docker Desktop** (oder Podman) läuft. Node 24 und die Supabase-CLI sind da (`npx supabase --version` → 2.117.0).

```powershell
# im Projektordner
npx supabase start                 # Container hochfahren (erster Start lädt Images, einige Minuten)
npx supabase db reset              # Migration + seed.sql einspielen (löscht lokale Daten!)
npx supabase status                # URLs und Keys: API, Studio, Inbucket (Mails), anon key, service_role key
npx supabase functions serve       # Edge Functions lokal, Hot Reload
npx supabase stop                  # Container stoppen
```

- Studio: `http://127.0.0.1:54323` — Tabellen ansehen, SQL ausführen.
- Mails (Magic Link) landen lokal in Inbucket: `http://127.0.0.1:54324`.
- Edge Function lokal: `POST http://127.0.0.1:54321/functions/v1/verify-qr`, Header `Authorization: Bearer <user jwt>`, Body `{"token":"DEMOtoken0000000000001"}`.

### Demo-Daten (nur lokal)

| Was | Wert |
|---|---|
| Demo-Inhaber | `demo-inhaber@on2u.local`, id `d0000000-0000-4000-8000-000000000001` — besitzt alle fünf Demo-Lokale |
| Demo-Gast | `demo-gast@on2u.local`, id `d0000000-0000-4000-8000-000000000002` |
| Demo-Lokale | `a0000000-0000-4000-8000-000000000001` … `…005` (Zur alten Fähre, Café Obstmarkt, Trattoria Regnitz, Bar Hain, Kebab Kettenbrücke) |
| Test-Tokens | `DEMOtoken0000000000001` (Zur alten Fähre, Tisch 1), `DEMOtoken0000000000002` (Bar Hain, Tisch 1) |

Anmelden lokal: im Frontend Magic Link an `demo-inhaber@on2u.local` schicken, Mail in Inbucket öffnen, Link klicken. Das gesetzte Passwort `on2u-demo` ist nur da, damit GoTrue keine leeren Spalten sieht; die App nutzt es nicht.

### Schnelle Checks nach `db reset` (im Studio → SQL Editor)

```sql
select place_id, is_fresh, confirmations_7d, owner_confirmed_7d, guest_confirmers_7d, avg_hearts
from public.place_freshness order by place_id;
-- erwartet: 001 grün (owner+guest), 002 grün, 003 gelb (95 Tage), 004 grün (guest), 005 gelb (nie)

select count(*) from public.qr_tokens;          -- 8 (2 feste + 2×3 erzeugte)
select length(token), token from public.qr_tokens limit 3;   -- immer 22 Zeichen
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
```

## In ein Supabase-Projekt bringen (macht Egor, nichts davon wurde hier ausgeführt)

1. Projekt im Dashboard anlegen (Region EU, z. B. Frankfurt). Datenbank-Passwort merken.
2. CLI anmelden und verbinden:
   ```powershell
   npx supabase login
   npx supabase link --project-ref <project-ref>      # steht in der Projekt-URL / Settings → General
   ```
3. Migration einspielen (legt auch die Buckets und Storage-Policies an):
   ```powershell
   npx supabase db push
   ```
   Falls `db push` bei den `storage.objects`-Policies mit „must be owner of table objects“ abbricht: die fünf `create policy … on storage.objects`-Statements aus dem Ende der Migration im Dashboard → SQL Editor ausführen und die Migration als angewendet markieren (`npx supabase migration repair --status applied 20260912000000`).
4. Edge Function deployen:
   ```powershell
   npx supabase functions deploy verify-qr --no-verify-jwt
   ```
   `--no-verify-jwt` entspricht `verify_jwt = false` in `config.toml`; die Funktion prüft das JWT selbst, um den deutschen 401-Text zu liefern. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sind in Edge Functions automatisch gesetzt.
5. Auth im Dashboard → Authentication → URL Configuration: **Site URL** auf die echte App-URL, **Redirect URLs** um `https://<app-domain>/auth/callback` ergänzen (lokal macht das `config.toml`; in der Cloud gilt das Dashboard). E-Mail-Provider aktiv lassen, „Confirm email“ kann aus bleiben (Magic Link bestätigt ohnehin).
6. **Seed nie in die Cloud.** `seed.sql` läuft nur bei `npx supabase db reset` lokal. `db push` spielt ihn nicht ein.
7. `npx supabase seed buckets` ist **nicht** nötig, die Buckets kommen aus der Migration.

## Was in `web/.env` gehört

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=
```

| Variable | Woher |
|---|---|
| `VITE_SUPABASE_URL` | Dashboard → Project Settings → **API** → „Project URL“ (`https://<project-ref>.supabase.co`). Lokal: `http://127.0.0.1:54321` (aus `npx supabase status`). |
| `VITE_SUPABASE_ANON_KEY` | Dashboard → Project Settings → **API** → „Project API keys“ → **anon public**. Lokal: Zeile „anon key“ aus `npx supabase status`. |
| `VITE_APP_URL` | Die URL, unter der die Web-App läuft (lokal `http://localhost:5173`), wird für QR-Links und Magic-Link-Redirect gebraucht. |

Den **service_role**-Key nie ins Frontend. Er wird nur in der Edge Function genutzt und dort automatisch bereitgestellt.

## Verifikation — ehrlich

- **Migration nicht lokal ausgeführt, Docker fehlt.** Auf diesem Rechner ist weder Docker noch Podman installiert (`npx supabase start` → „docker: command not found (podman also not found)“). Damit konnten `db reset`, Seed und Edge Function nicht gegen eine echte Datenbank laufen.
- Stattdessen: SQL zweimal vollständig gegengelesen (Syntax, Reihenfolge der Objekte, Policy-Logik, Grants). Dabei gefunden und behoben: `is_place_owner` (SQL-Funktion) stand vor der Tabelle `places`, die sie referenziert; SQL-Funktionen werden beim Anlegen geprüft, das wäre ein Fehler gewesen.
- `config.toml` wurde von der CLI geparst (`npx supabase start` kam bis zum Docker-Check), ist also syntaktisch gültig.
- Edge Function mit `deno check --config supabase/functions/verify-qr/deno.json` (Deno 2.9.6, supabase-js 2.116) typgeprüft: **keine Fehler**. Laufzeit gegen die DB konnte ohne Docker nicht getestet werden.
- Sobald Docker da ist: `npx supabase start`, `npx supabase db reset`, dann die Checks oben. Erwartbare Stolperstellen, falls doch etwas hakt: Reihenfolge der Funktionen, Storage-Policy-Rechte, Spaltenliste von `auth.users` im Seed (GoTrue-Version).

## Abweichungen vom Vertrag

Keine inhaltlichen. Ergänzungen, die der Vertrag offen lässt:

- Zusätzliche Check-Constraints: `menu_confirmations` und `videos` erzwingen „`visit_id`/`review_id` null genau bei `by = 'owner'`“; `qr_tokens.token` muss 22 Zeichen haben; `places.lat/lng` im gültigen Bereich; Namen nicht leer.
- `on delete cascade` auf allen FKs zu `auth.users` und `places` (Nutzer- oder Lokal-Löschung räumt auf). Der Vertrag nennt cascade nur für `menu_items`, `menu_photos`, `qr_tokens`, `videos`.
- RPCs liefern zusätzliche deutsche Fehlertexte, die der Vertrag nicht vorgibt (z. B. „Nur der Inhaber kann die Speisekarte bestätigen.“, „Bitte 1 bis 100 Tische angeben.“).
- `verify-qr`: fehlender oder leerer `token` im Body wird wie „unbekannt“ behandelt (404 mit Vertragstext), damit das Frontend nur die drei Vertragsfälle kennen muss. Bei 429 werden neben `visit_id` auch `place_id`, `place_name`, `table_label` mitgegeben.
- Inhaber dürfen Objekte im Bucket `menu-photos` unter ihrer `place_id` auch löschen (nicht im Vertrag, für das Neu-Fotografieren nötig). Im Bucket `videos` gibt es kein Löschen über die API (offen, siehe unten).

## Nicht gemacht / offen

- **Lokal nicht gelaufen** (Docker fehlt). Erster Schritt für Egor oder den nächsten Agenten: Docker Desktop installieren, `npx supabase start`, `npx supabase db reset`, Checks oben.
- Kein Remote-Projekt angelegt, nichts gelinkt, nichts deployt (Vorgabe).
- `web/.env.example` nicht angelegt (Ordner `web/` gehört dem Frontend-Agenten). Inhalt steht oben.
- Videos löschen (eigene Uploads, Inhaber-Videos am Lokal) fehlt als Storage-Policy und in der DB gibt es keine Aufräum-Logik für verwaiste Dateien.
- Keine Rate-Limits auf den RPCs (z. B. `create_qr_tokens` beliebig oft). Für den Bamberg-Test vertretbar.
- `place_freshness` ist eine normale View, keine materialisierte. Bei vielen Bestätigungen später Index-Check oder Materialisierung.
- Keine Tests (pgTAP) für Policies. Wenn Docker da ist: `npx supabase test new` wäre der Einstieg.
- GDPR-Löschung eines Nutzers: durch `on delete cascade` verschwinden Besuche, Bewertungen und Bestätigungen — das verändert rückwirkend die Frische der Lokale. Produktentscheidung für Egor, ob Bestätigungen anonymisiert statt gelöscht werden sollen.
