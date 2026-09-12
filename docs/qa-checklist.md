# QA-Checkliste — ON2U Eats Web v0.3

Datum: 12.09.2026
Umgebung: Chrome (Claude-Browser-Pane), Vite-Dev-Server `http://127.0.0.1:5173`, echtes Supabase-Projekt (`oqfrgaqiwpczbtetssvc`), Datenbank leer (0 Lokale). Viewports: Desktop (1024×768), Tablet (768×1024), Mobile (375×812). Kamera im Test-Browser blockiert — QR-Scan nur über „Code eintippen" und Deep-Link geprüft.

## Ergebnisse

| # | Check | Status | Notiz |
|---|---|---|---|
| 1 | Karte: Kacheln, Suche, Filter-Chips, „Mein Standort", Leerzustand | ✅ | Text exakt „Noch kein Lokal in deiner Nähe eingetragen. Kennst du eins? Schlag es vor." Kein „Backend nicht verbunden" (echte Keys aktiv). Alle 3 Viewports ok. |
| 2 | Feed lädt fehlerfrei, deutscher Leerzustand | ✅ | „Noch keine Videos. Scann am Tisch und nimm das erste auf." |
| 3a | Scan → „Code eintippen" → Code | ✅ | Kurzer Code (< 16 Zeichen, z. B. „abc") wird clientseitig abgelehnt: „Code nicht erkannt. Näher ran oder das Licht am Tisch anmachen." — korrektes Verhalten, `TOKEN_RE` verlangt 16–64 Zeichen wie ein echter QR-Token. |
| 3b | Gültig geformter (aber unbekannter) Token → Login-Screen | ✅ | „Kurz anmelden" erscheint korrekt, da kein Session vorhanden. |
| 3c | Deep-Link `/scan?t=abc` | ✅ | Gleiches Verhalten wie 3a (Token zu kurz → Scan-Screen, kein Login). |
| 3d | E-Mail-Formular → `/auth/v1/otp` | ⚠️ | Mit `@example.com` antwortet Supabase 400 `email_address_invalid` (Supabase-seitige Domain-Sperre, kein App-Fehler) — App zeigt korrekt „Das sieht nicht wie eine E-Mail-Adresse aus." Mit echter Domain (getestet: `@gmail.com`) 200 OK, App zeigt „Link geschickt. Schau in dein Postfach." Für künftige Tests keine `@example.com`-Adressen verwenden. |
| 4 | Gespeichert: Leerzustand deutsch | ✅ | „Noch nichts gespeichert. Tippe auf der Karte oder im Feed auf „Merken"." |
| 4b | Profil: Gast/Inhaber-Schalter, Login-Karte, keine Konsolenfehler | ✅ | „Mein Restaurant" zeigt korrekt Login-Aufforderung „Für dein Lokal brauchst du ein Konto." |
| 5a | `/place/00000000-0000-4000-8000-000000000000` | ✅ | „Dieses Lokal gibt es nicht mehr." — ruhiger Zustand, kein Crash. |
| 5b | `/auth/callback` ohne Token | ✅ | Kein Crash, springt zu Profil mit „Anmeldung nicht geklappt. Link nochmal anfordern." |
| 5c | Unbekannter Pfad `/xyz` | ✅ | Fällt sinnvoll auf die Karte zurück. |
| 6 | Grep nach Lorem/Demo/TODO/Englisch | ✅ | Keine Treffer für „Lorem", „TODO", „Demo" in `web/src`. Stichprobe auf englische UI-Strings (Save/Cancel/Submit/…) ohne Treffer — App ist durchgehend Deutsch. `BACKEND_HINT` („Backend nicht verbunden.") existiert als Fallback-Text, aktuell inaktiv, da Keys gesetzt sind — kein Fehler. |
| 7 | Konsole/Netzwerk: keine unerwarteten 4xx/5xx | ✅ | Erwartete 4xx: 401 bei direkten Testabfragen auf `qr_tokens`/`visits` als `anon` (RLS korrekt), 400 bei OTP mit `@example.com` (s. o.). Keine uncaught Errors auf einer der Seiten. |
| 8 | `npx tsc --noEmit` / `npm run build` | ✅ | Beide fehlerfrei. Build-Output: `dist/` ca. 1 MB gesamt (größte Chunks `qr-pdf` 445 KB, `index` 426 KB, `jsQR` 130 KB — unkritisch für Schritt 1). |
| 9 | PWA: `/manifest.webmanifest`, `/sw.js` | ✅ | Beide 200. Manifest: `name`/`short_name` „ON2U Eats", `display: standalone`, `theme_color: #0c0c0c`, `background_color: #0c0c0c`, Icon vorhanden (`icon.svg`, `any maskable`). |

**9 von 9 Prüfpunkten bestanden** (einer mit Hinweis ⚠️, kein Code-Fehler — Supabase lehnt `@example.com` grundsätzlich ab).

## Behoben

Keine Code-Änderungen nötig — beim Durchklicken wurden keine Bugs gefunden, die einen Fix erfordert hätten. Ein initial beobachteter Konsolenfehler „`place_freshness` not found in schema cache" (PGRST205) stellte sich in einem frischen Tab als transienter Zustand heraus (PostgREST-Schema-Cache direkt nach Migration), nicht reproduzierbar — kein Code-Fix nötig.

## Offen

1. **(niedrig)** Toast-Text bleibt nach dem Ausblenden im DOM (`opacity:0`, nicht `display:none`) und taucht dadurch in Screenreader-/Text-Extraktion weiterhin auf, auch wenn er visuell verschwunden ist (`web/src/ui.ts:22-35`, `.toast` in `web/src/styles/app.css:236`). Für Schritt 1 unkritisch, für Barrierefreiheit später prüfen.
2. **(niedrig)** `docs/schema-contract.md` und QA-Auftrag gehen von einem Test mit `t=abc` aus; der reale Token-Regex verlangt 16–64 Zeichen. Kurze Testcodes wie „abc" werden clientseitig ohne Serverkontakt abgelehnt (richtiges Verhalten, aber falls Egor selbst mit kurzen Test-Strings hantiert, wirkt es zunächst wie „nichts passiert"). Keine Code-Änderung empfohlen, nur als Hinweis für Doku/Onboarding.
3. **(info)** Owner-Onboarding, echtes QR-Scannen mit Kamera, Video-Upload und Magic-Link-Empfang konnten in dieser Umgebung nicht Ende-zu-Ende getestet werden (keine Kamera, kein Mail-Postfach-Zugriff). Codepfade wurden gelesen (`web/src/screens/owner.ts`, `web/src/lib/qr.ts`, `web/src/lib/qr-pdf.ts`) und wirken vollständig, aber ungetestet auf echten Geräten.

## Manuell auf dem Handy prüfen (für Egor)

- [ ] iPhone Safari: Seite öffnen, „Zum Home-Bildschirm" hinzufügen, App startet standalone (kein Browser-Chrome).
- [ ] Android Chrome: „Zum Startbildschirm hinzufügen" / Install-Prompt, App startet standalone.
- [ ] iPad: Layout mit Navigationsleiste links und Karte, Lokal als Seiten-Panel.
- [ ] Kamera-QR-Scan mit einem ausgedruckten Code (Tisch-QR aus dem PDF) — Sucher erkennt den Code automatisch, springt direkt weiter ohne „Code eintippen".
- [ ] Magic Link auf dem Handy: E-Mail eingeben, Mail auf demselben Gerät öffnen, Link antippen → App öffnet sich auf `/scan` (bzw. `/profile`) eingeloggt.
- [ ] Video-Aufnahme direkt aus der Kamera bei „Kurzes Video aufnehmen" (nicht nur Datei-Auswahl aus der Galerie), Fortschrittsanzeige beim Hochladen.
- [ ] PDF-Download der QR-Codes aus dem Inhaber-Bereich — öffnet/speichert sich korrekt auf iOS und Android, alle Tische enthalten, Code lesbar in Druckgröße.
- [ ] Inhaber-Onboarding komplett durchklicken: Lokal anlegen (Pin auf echter Karte setzen), Speisekarte eintippen oder fotografieren, bestätigen, QR-Codes bestellen — mit einem echten Test-Lokal, danach wieder löschen/nicht in Produktivdaten belassen.
