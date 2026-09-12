# CLAUDE.md — ON2U Eats

Du arbeitest am Projekt **ON2U Eats**: Karte + Video + bestätigte Speisekarten für Restaurants und Bars. Gründer: Egor (Bamberg), Marke ON2U (on2u.de). Kommunikation mit Egor auf Russisch, Code-Kommentare und UI-Texte auf Deutsch, Code selbst auf Englisch.

Lies zuerst, in dieser Reihenfolge:
1. `README.md` — was es ist, Status
2. `docs/concept.md` — Position, Flows, Prinzipien, was in Bamberg getestet wird
3. `docs/screens.md` — Screen-Inventar und was fehlt
4. `design/tokens.md` — Farben, Typo, Motion
5. `prototype/index.html` — klickbarer HTML-Prototyp v0.1, die visuelle Referenz für alle Screens

## Die eine Regel

Der grüne Punkt „Karte aktuell" ist das Produkt. Jede Entscheidung — Datenmodell, Screen, Onboarding — wird daran gemessen, ob sie die Speisekarte aktueller macht. Feed und Video sind bekannte Muster, die wir übernehmen, nicht neu erfinden. Wir konkurrieren nicht mit TikTok oder Google Maps; wir füllen die Lücke, die beide lassen.

## Stack — entschieden am 12.09.2026: Web zuerst (Option B)

Egor hat sich für **Web zuerst** entschieden: schnell in Bamberg testbar, kein App-Store, auf Smartphone, Tablet und Desktop gleichermaßen bedienbar. Ausgangspunkt ist `web/index.html` (v0.2, kein Build, Leaflet eingebettet). Nächster technischer Schritt: Umbau auf **Vite + TypeScript**, dabei `lib/data/` wiederverwenden. Der Expo-Skelett in `app/` bleibt liegen für später.

Option A (später): **React Native + Expo (managed), expo-router, TypeScript strict, react-native-reanimated, expo-camera (QR), react-native-maps** — gleicher Stack wie die ON2U-Shop-App (`/apps` im Skill `on2u-app-developer`), Wissen vorhanden.
Option B: **Web-App zuerst** (Next.js oder plain Vite + PWA), schneller in Bamberg testbar, kein App-Store. Später Wrapping.

Backend — **entschieden 12.09.2026: Supabase** (Postgres + Storage für Videos + Auth per Magic Link). Kein Shopify als Basis (E-Commerce-Datenmodell passt nicht; evtl. später nur für Abrechnung). Keine eigene Infrastruktur vor dem Bamberg-Test.

Schritt-1-Plan mit Subagenten und Definition of Done: `docs/kickoff-claude-code.md`.

## Datenmodell (Kern, für den grünen Punkt)

- `place` — id, name, category, lat/lng, address, owner_id
- `menu_item` — place_id, name, description, price_cents, currency
- `menu_confirmation` — place_id, by (owner | guest), user_id, visit_id?, prices_match (bool), created_at
- `visit` — place_id, user_id, qr_token, created_at (nur durch QR-Scan am Tisch)
- `review` — visit_id, hearts 1–5, tags[], video_url?, created_at (nur mit visit)
- `video` — place_id, by (owner | guest), url, created_at

Regel für „Karte aktuell": mindestens eine `menu_confirmation` in den letzten 7 Tagen **und** nicht ≥ 3 `prices_match = false` in den letzten 7 Tagen. Beides als SQL-View oder Funktion, nicht im Client berechnet.

## Design

Tokens aus `design/tokens.md` als `theme/tokens.ts`. Poppins + Lora Italic. Terrakotta `#c96a4a` nur für Scan-Button, primäre CTA, Herzen, aktive Pins. Ein Motion-Motiv: Herzschlag. Kein Konfetti, keine Neonfarben, keine Slide-In-Animationen pro Abschnitt.

## UI-Texte

Deutsch, wie man spricht. „Danke." statt „Vielen Dank für Ihre Bewertung." Fehler sagen, was passiert ist und was zu tun ist: „Code nicht erkannt. Näher ran oder das Licht am Tisch anmachen." Vollständige Textliste in `docs/screens.md`. Später i18n: en, sq (Albanisch), cnr (Montenegrinisch).

## Arbeitsweise

- Bevor du Code schreibst: Stack mit Egor bestätigen (siehe oben).
- Parallele Subagenten sind sinnvoll für: (1) Konkurrenz-Recherche (TikTok Local Feed, Google Maps Video-Reviews, BiteMap, Zest, JaiFaim) — Ergebnis in `docs/research/`; (2) Backend-Schema + Supabase-Setup; (3) UI-Komponenten aus dem Prototyp.
- Keine erfundenen Restaurants oder Preise in Produktivdaten. Demo-Daten nur in `lib/demo/` und klar als Demo markiert.
- Jeder PR: kurze Beschreibung auf Deutsch, was sich für den Nutzer ändert.
- Wenn du dir bei einer Produktentscheidung unsicher bist: nicht raten, Egor fragen. Er testet mit echten Gastronomen in Bamberg.

## Nicht tun

- Kein Login-Zwang vor der Karte. Karte und Lokal sind ohne Konto sichtbar.
- Keine Bewertung ohne `visit`. Nie.
- Keine Speicherung von Zahlungsdaten. Monetarisierung ist bewusst noch nicht Thema.
