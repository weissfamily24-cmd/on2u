# ON2U Eats — Web v0.2

Mobile-first Web-App (PWA). Läuft ohne Build: `index.html` auf einen beliebigen Static-Host legen (Netlify, Vercel, GitHub Pages, Cloudflare Pages) — fertig. Auf dem Handy „Zum Home-Bildschirm" → verhält sich wie eine App.

## Was drin ist
- **Karte** — echte OpenStreetMap-Karte (Leaflet, eingebettet, kein API-Key), dunkel eingefärbt. Pins in Terrakotta pulsieren, wenn die Speisekarte in den letzten 7 Tagen bestätigt wurde; graue Pins sind ungeprüft. Suche, Filter-Chips, „Mein Standort" (Geolocation, sortiert nach Entfernung).
- **Feed** — vertikaler Snap-Feed, Herz, Merken, Route (öffnet Google Maps Navigation).
- **Lokal** — auf dem Handy Vollbild, auf Tablet/Desktop als Panel rechts über der Karte.
- **Scan** — Kamera-Zugriff (echte QR-Erkennung folgt), Bewertung mit Herzen, **„Stimmen die Preise?"**, Tags, Video-Auswahl. Eine Bewertung verändert sofort den Frische-Status des Lokals.
- **Gespeichert / Profil** — lokal auf dem Gerät (localStorage), Inhaber-Ansicht als Demo.

## Layout
- < 768 px: Tab-Bar unten, ein Screen zur Zeit
- ≥ 768 px: Navigations-Leiste links, Karte füllt den Rest, Lokal als Seiten-Panel
- ≥ 1100 px: Lokal-Liste als Spalte links über der Karte

## Bekannte Grenzen (v0.2)
- QR wird noch nicht wirklich gelesen — Button „Demo: Code erkannt". Nächster Schritt: `BarcodeDetector` API + Fallback (jsQR).
- Alle Daten sind Demo-Daten in `index.html` (`PLACES`). Backend (Supabase) folgt, Schema in `../CLAUDE.md`.
- Videos werden ausgewählt, aber nicht hochgeladen.
- Leaflet ist eingebettet (~150 KB), damit die Datei allein funktioniert. Für den Vite-Umbau: `npm i leaflet` und normal importieren.

## Nächste Schritte
1. In Bamberg mit 3–5 Gastronomen und 10 Gästen testen (Fragen in `../docs/concept.md`)
2. Echte QR-Erkennung
3. Supabase: `place`, `menu_item`, `menu_confirmation`, `visit`, `review`
4. Umbau auf Vite + TypeScript, Wiederverwendung von `../lib/data/freshness.ts`
