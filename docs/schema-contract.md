# Schema-Vertrag Backend ↔ Frontend (Schritt 1)

Stand 12.09.2026. Dieses Dokument ist die verbindliche Schnittstelle zwischen `supabase/` und `web/`. Backend implementiert genau das; Frontend programmiert genau dagegen. Änderungen nur hier, dann in beiden Teilen.

Quelle der Regeln: `CLAUDE.md` (Datenmodell, Frische-Regel), `docs/kickoff-claude-code.md` (Definition of Done).

## Grundsätze

- Postgres in Supabase, Schema `public`. Tabellen im Plural, `snake_case`. Primärschlüssel `id uuid default gen_random_uuid()`. Zeitstempel `timestamptz default now()`.
- Lesen ohne Konto: `places`, `menu_items`, `menu_confirmations`, `reviews`, `videos`, `place_freshness` sind für `anon` lesbar.
- Schreiben nur mit Konto (Magic Link). Gäste schreiben nur eigene `visits`/`reviews` (über RPC / Edge Function, nicht direkt). Inhaber schreiben nur eigene `places`, `menu_items`, `qr_tokens`, `videos`.
- Inhaber = `places.owner_id = auth.uid()`. Keine Rollentabelle. Wer ein Lokal anlegt, ist dessen Inhaber.
- **Keine Bewertung ohne `visit`.** Erzwungen in der Datenbank (FK + RPC), nicht nur im Client.
- Frische wird **in SQL** berechnet (View `place_freshness`), der Client zeigt nur an. `lib/data/freshness.ts` bleibt als Offline-/Demo-Spiegel.

## Tabellen

### `places`
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid → auth.users | not null |
| name | text | not null |
| category | text | z. B. 'Fränkisch', 'Café', 'Italienisch', 'Bar', 'Imbiss' |
| lat, lng | double precision | not null |
| address | text | not null |
| caption | text | optional, ein Satz (Lora Italic im UI) |
| created_at | timestamptz | |

### `menu_items`
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| place_id | uuid → places | on delete cascade |
| name | text | not null |
| description | text | optional |
| price_cents | integer | not null, ≥ 0 |
| currency | text | default 'EUR', check in ('EUR','ALL') |
| position | integer | Sortierung, default 0 |
| created_at | timestamptz | |

### `menu_photos`
Foto der Speisekarte (Schritt 1: nur Bild speichern und anzeigen, **keine OCR**).
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| place_id | uuid → places | cascade |
| path | text | Pfad im Bucket `menu-photos` |
| created_at | timestamptz | |

### `qr_tokens`
Ein Token pro Tisch. Wird beim QR-Druck erzeugt.
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| place_id | uuid → places | cascade |
| token | text unique | 22 Zeichen, URL-sicher (base64url aus 16 Zufallsbytes), in der DB erzeugt |
| table_label | text | z. B. 'Tisch 3' |
| active | boolean | default true |
| created_at | timestamptz | |

QR-Inhalt (URL, die der Gast scannt): `{APP_URL}/scan?t={token}`. Das Frontend liest `t` aus der URL **oder** aus dem Kamera-Scan.

### `visits`
Nur über die Edge Function `verify-qr` anlegbar.
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| place_id | uuid → places | |
| user_id | uuid → auth.users | not null |
| qr_token | text | der gescannte Token |
| table_label | text | Kopie aus qr_tokens |
| created_at | timestamptz | |

### `reviews`
Nur über RPC `submit_review` anlegbar. Genau eine Bewertung pro Besuch.
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| visit_id | uuid → visits, **unique** | |
| place_id | uuid → places | denormalisiert fürs Lesen |
| user_id | uuid → auth.users | |
| hearts | smallint | check 1..5 |
| tags | text[] | default '{}' |
| video_path | text | optional, Pfad im Bucket `videos` |
| created_at | timestamptz | |

### `menu_confirmations`
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| place_id | uuid → places | |
| by | text | check in ('owner','guest') |
| user_id | uuid → auth.users | |
| visit_id | uuid → visits | null bei 'owner' |
| prices_match | boolean | not null |
| created_at | timestamptz | |

### `videos`
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| place_id | uuid → places | cascade |
| by | text | check in ('owner','guest') |
| user_id | uuid → auth.users | |
| review_id | uuid → reviews | null bei 'owner' |
| path | text | Pfad im Bucket `videos` |
| caption | text | optional |
| created_at | timestamptz | |

## View `place_freshness`

Eine Zeile pro Lokal. `anon` darf lesen.

| Spalte | Typ | Bedeutung |
|---|---|---|
| place_id | uuid | |
| is_fresh | boolean | ≥ 1 Bestätigung in 7 Tagen **und** < 3 `prices_match = false` in 7 Tagen |
| last_confirmed_at | timestamptz | letzte Bestätigung überhaupt, null wenn nie |
| confirmations_7d | integer | alle Bestätigungen in 7 Tagen |
| mismatches_7d | integer | `prices_match = false` in 7 Tagen |
| owner_confirmed_7d | boolean | Inhaber hat in 7 Tagen bestätigt |
| guest_confirmers_7d | integer | verschiedene Gäste mit Bestätigung in 7 Tagen |
| avg_hearts | numeric(3,2) | Mittel aller reviews, null wenn keine |
| review_count | integer | |

UI-Text daraus: grün „Speisekarte bestätigt · vor 2 Tagen · vom Inhaber und 4 Gästen", gelb „Karte ungeprüft · Preise können abweichen".

## RPCs (Postgres-Funktionen, `security definer`, per `supabase.rpc(...)`)

### `submit_review(p_visit_id uuid, p_hearts smallint, p_prices_match boolean, p_tags text[], p_video_path text default null) returns uuid`
Prüft: `visit.user_id = auth.uid()`, noch keine Review für diesen Besuch. Legt in **einer Transaktion** an: `reviews`, `menu_confirmations` (by='guest', visit_id), bei `p_video_path` zusätzlich `videos` (by='guest', review_id). Gibt `review.id` zurück. Fehler als `raise exception` mit deutschen Texten: `'Besuch nicht gefunden.'`, `'Für diesen Besuch hast du schon bewertet.'`.

### `confirm_menu(p_place_id uuid) returns uuid`
Nur Inhaber des Lokals. Legt `menu_confirmations` (by='owner', prices_match=true) an. Gibt id zurück.

### `create_qr_tokens(p_place_id uuid, p_count integer) returns setof qr_tokens`
Nur Inhaber. Erzeugt `p_count` Tokens mit `table_label = 'Tisch ' || n` (n fortlaufend ab der nächsten freien Nummer). Max 100 pro Aufruf.

### `replace_menu(p_place_id uuid, p_items jsonb) returns void`
Nur Inhaber. Ersetzt alle `menu_items` des Lokals in einer Transaktion. `p_items` = `[{ "name", "description", "price_cents", "currency" }]`, Reihenfolge = `position`.

## Edge Function `verify-qr`

`POST {SUPABASE_URL}/functions/v1/verify-qr`, Header `Authorization: Bearer <user jwt>`, Body `{ "token": "..." }`.

Antwort 200:
```json
{ "visit_id": "uuid", "place_id": "uuid", "place_name": "Schlenkerla", "table_label": "Tisch 3" }
```
Fehler (Body `{ "error": "..." }`, Text deutsch, direkt anzeigbar):
- 401 `"Bitte melde dich an, um zu bewerten."`
- 404 `"Code nicht erkannt. Näher ran oder das Licht am Tisch anmachen."` (Token unbekannt oder inaktiv)
- 429 `"Du hast hier gerade schon eingecheckt."` (gleicher Nutzer, gleiches Lokal, < 30 Minuten) — Antwort enthält zusätzlich `visit_id` des bestehenden Besuchs, das Frontend nutzt ihn weiter.

## Storage

| Bucket | Öffentlich lesbar | Upload | Limit | Pfad |
|---|---|---|---|---|
| `videos` | ja | authenticated | 50 MB, `video/mp4`, `video/quicktime`, `video/webm` | `{place_id}/{uuid}.{ext}` |
| `menu-photos` | ja | nur Inhaber des Lokals (Pfad beginnt mit eigener place_id) | 10 MB, `image/*` | `{place_id}/{uuid}.{ext}` |

Öffentliche URL: `supabase.storage.from(bucket).getPublicUrl(path)`.

## Auth

- Magic Link per E-Mail (`signInWithOtp`), kein Passwort. Redirect auf `{APP_URL}/auth/callback`.
- Lokal: Supabase-Mails landen in Inbucket (`npx supabase status` zeigt die URL).
- Gast braucht Konto erst beim Scan. Karte, Feed, Lokal sind ohne Konto.

## Umgebungsvariablen

`web/.env.example` (ohne Werte):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=
```
Edge Functions bekommen `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` automatisch.

## Demo-Daten

Nur in `supabase/seed.sql`, klar als Demo markiert (Namen der fünf Lokale aus `lib/demo/places.ts`), läuft nur lokal (`supabase db reset`). Nie in die Produktiv-DB.
