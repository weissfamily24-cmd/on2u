# ON2U Eats

Karte + Video + bestätigte Speisekarten. Restaurants und Bars, die es wirklich gibt, mit Preisen, die stimmen.

**Status:** Schritt 1 (12.09.2026) — Web-App v0.3 (Vite + TypeScript) in `web/`, Backend Supabase in `supabase/`, bereit für den Bamberg-Test sobald das Supabase-Projekt verbunden ist
**Testgebiet:** Bamberg (lokale Restaurants), danach Albanien / Montenegro
**Sprache der App:** Deutsch (später Englisch, Albanisch, Montenegrinisch)

## Was das Produkt löst

Touristen und Einheimische finden Lokale auf Google Maps nicht oder sehen veraltete Preise. Restaurants pflegen ihr Google-Profil nicht. ON2U Eats verbindet drei Dinge, die es einzeln schon gibt, aber nicht zusammen:

| Google Maps | TikTok / Instagram | ON2U Eats |
|---|---|---|
| Karte, Route | Kurze Videos, Feed | Karte **und** Feed |
| Speisekarte oft alt, Preise falsch | keine Preise | Speisekarte mit Datum, vom Inhaber **und** von Gästen bestätigt |
| Bewertungen von jedem | Likes ohne Kontext | Bewertung nur nach QR-Scan am Tisch (Besuch bestätigt) |

Das eine Merkmal, das alles trägt: **der grüne Punkt „Karte aktuell"**. Er erscheint nur, wenn die Speisekarte in den letzten 7 Tagen bestätigt wurde. Auf der Karte pulsieren diese Pins.

## Struktur

```
on2ueats/
├── README.md                 ← du bist hier
├── CLAUDE.md                 ← Anweisungen für Claude Code (Kontext, Regeln, Datenmodell)
├── web/                      ← **Web-App v0.3** — Vite + TypeScript, src/screens, src/lib/api.ts. Die aktuelle Baustelle.
├── supabase/                 ← Migration (Schema, RLS, place_freshness, RPCs), Edge Function verify-qr, Seed (nur lokal)
├── app/                      ← Expo-Router-Skelett für später (Option A), bleibt liegen
├── components/               ← Icon, FreshBadge (der grüne Punkt), HeartbeatPulse
├── theme/tokens.ts           ← Farben, Typo, Abstände als Code
├── lib/data/                 ← Typen und die Frische-Regel (isMenuFresh)
├── lib/demo/                 ← Demo-Daten Bamberg, nie in Produktion
├── docs/
│   ├── concept.md            ← Zielgruppen, Flows, Prinzipien
│   ├── screens.md            ← alle Screens, was drauf ist, was noch fehlt
│   ├── kickoff-claude-code.md← Schritt-1-Plan, Definition of Done
│   ├── schema-contract.md    ← verbindliche Schnittstelle Backend ↔ Frontend
│   ├── backend.md            ← Supabase: was existiert, lokal starten, in die Cloud bringen
│   └── research/competitors.md ← TikTok Nearby, Google Maps, BiteMap, Zest, JaiFaim
├── design/
│   └── tokens.md             ← Farben, Typografie, Abstände, Motion
└── prototype/
    └── index.html            ← klickbarer Prototyp (öffnen im Browser oder am Handy)
```

## Prototyp öffnen

`prototype/index.html` im Browser öffnen. Am Handy im Vollbild, am Desktop im Phone-Rahmen. Alles klickbar: Pins, Karten im Feed, Herzen, Scan-Flow, Inhaber-Ansicht im Profil. Alle Daten sind Demo-Daten.

## Web-App starten

```
cd web
npm install
copy .env.example .env      # Supabase-URL und anon key eintragen, siehe docs/backend.md
npm run dev
```
Details in `web/README.md`. Backend: `docs/backend.md`. Das Expo-Skelett in `app/` ist nicht Teil von Schritt 1.

## Nächste Schritte

1. Supabase-Projekt verbinden (`docs/backend.md`), Web-App statisch hosten (Vercel oder Netlify), Domain in Schritt 2
2. In Bamberg: ein echtes Lokal anlegen, QR-Codes drucken, mit 3–5 Gastronomen und 10 Gästen testen (Fragen in `docs/concept.md`)
3. Danach entscheiden: Name, Monetarisierung, Speisekarten-Foto → Text (OCR)
