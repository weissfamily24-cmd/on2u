# ON2U Eats — Web v0.3 (Vite + TypeScript + Supabase)

Mobile-first Web-App (PWA). Auf dem Handy „Zum Home-Bildschirm" → verhält sich wie eine App. Läuft auf Smartphone, Tablet und Desktop.

## Starten

```powershell
cd web
npm install
copy .env.example .env      # dann VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL eintragen
npm run dev                 # http://localhost:5173
npm run build               # Typecheck + Produktions-Build nach dist/
```

Ohne Schlüssel in `.env` startet die App trotzdem und zeigt „Backend nicht verbunden." Woher die Werte kommen: `../docs/backend.md`.

## Struktur

```
web/
├── index.html            Vite-Einstieg
├── public/               manifest, icon, sw.js, _redirects (Netlify)
├── vercel.json           SPA-Rewrite (Vercel)
└── src/
    ├── main.ts           Start, Tab-Bar, Screen-Wechsel
    ├── router.ts         /, /feed, /scan, /saved, /profile, /place/:id, /auth/callback
    ├── config.ts         APP_NAME (einzige Stelle), APP_URL, Tags, Limits
    ├── ui.ts             kleine DOM-Helfer, Icons, Toast
    ├── lib/
    │   ├── supabase.ts   Client aus VITE_-Variablen, backendConfigured
    │   ├── api.ts        alle Zugriffe, exakt nach ../docs/schema-contract.md
    │   ├── qr.ts         BarcodeDetector, Fallback jsQR, /scan?t=TOKEN
    │   ├── qr-pdf.ts     QR-Karten als PDF (pdf-lib + qrcode)
    │   └── storage.ts    Gespeichert, letzter Tab, wartender Token (localStorage)
    ├── screens/          map, feed, place, scan, saved, profile, owner, auth
    └── styles/           tokens.css (design/tokens.md), app.css
```

`../lib/data/freshness.ts` und `types.ts` werden per Import wiederverwendet (Labels, Preisformat). Ob ein Lokal grün ist, entscheidet die View `place_freshness` in der Datenbank, nicht der Client.

## Was drin ist

- **Karte** — Leaflet/OSM, dunkel. Pins in Terrakotta pulsieren bei „Karte aktuell", graue Pins sind ungeprüft. Suche, Filter-Chips, Mein Standort.
- **Feed** — vertikaler Snap-Feed aus dem Bucket `videos`, Herz, Merken, Route.
- **Lokal** — Video-Hero, Bestätigungs-Block (grün/gelb aus `place_freshness`), Speisekarte mit Preisen und Fotos, Gäste-Videos, Mini-Karte.
- **Scan** — Kamera + QR, Deep-Link `/scan?t=TOKEN`, Code eintippen. Anmeldung per Magic Link erst hier. Dann: Herzen → „Stimmen die Preise?" → Tags → optionales Video mit Fortschritt → `submit_review` → „Danke."
- **Gespeichert** — lokal auf dem Gerät.
- **Profil** — Gast / Mein Restaurant. Inhaber: Lokal anlegen (Pin auf der Karte setzen), Speisekarte tippen oder fotografieren, bestätigen, QR-Codes als PDF drucken, Inhaber-Video hochladen.

## Layout

- < 768 px: Tab-Bar unten, ein Screen zur Zeit
- ≥ 768 px: Navigations-Leiste links, Karte füllt den Rest, Lokal als Seiten-Panel
- ≥ 1100 px: Lokal-Liste als Spalte links über der Karte

## Bekannte Grenzen (v0.3)

- Speisekarten-Foto wird nur gespeichert und angezeigt, nicht ausgelesen (keine OCR).
- Videos können nicht gelöscht werden.
- Eine Sprache (Deutsch). Kein Push, keine Reservierung, keine Kommentare (bewusst, Schritt 1).
