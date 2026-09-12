# Screens v0.1

Navigation: Tab-Bar unten mit fünf Einträgen. Scan ist der erhobene Terrakotta-Button in der Mitte, weil er die wichtigste Aktion ist.

| Tab | Screen | Im Prototyp | Fehlt noch |
|---|---|---|---|
| Karte | Stilisierte Karte Bamberg, Suche, Filter-Chips, 5 Pins, Bottom-Sheet mit Karten | ✅ | Echte Karte (Mapbox / Google Maps SDK), Clustering, „Jetzt offen" wirklich filtern |
| Feed | Vertikaler Snap-Feed, 4 Posts, Herz mit Herzschlag, Merken, Route, Badges | ✅ | Echte Videos, Kommentare, Folgen, Sound-Toggle, Ladezustand |
| Scan | Sucher mit Rahmen und Scan-Linie → Bewertungs-Formular → Dank-Screen | ✅ | Echter Kamera-Zugriff, Video-Aufnahme, Upload |
| Gespeichert | Führt derzeit ins Profil (Liste „Gespeichert") | ⚠️ | Eigener Screen mit Karte + Liste |
| Profil | Schalter Gast / Mein Restaurant, Stats, Gespeichert, Inhaber-Verwaltung | ✅ | Login, Einstellungen, Sprache wechseln |
| Lokal (Detail) | Video-Hero, Meta, Bestätigungs-Block, Speisekarte, CTAs, Gäste-Videos, Mini-Karte | ✅ | Öffnungszeiten-Tabelle, Reservierung, Teilen, vollständige Speisekarte |

## Zustände, die noch fehlen

- Leer: „Noch kein Lokal in deiner Nähe eingetragen. Kennst du eins? Schlag es vor."
- Offline: ruhiger Screen mit Herzschlag, „Gerade kein Netz. Deine gespeicherten Lokale sind da."
- Fehler beim Scan: „Code nicht erkannt. Näher ran oder das Licht am Tisch anmachen."
- Inhaber-Onboarding: Lokal anlegen → Karte fotografieren → Prüfen → QR bestellen (4 Schritte)

## Interaktionen im Prototyp

- Pin oder Karte im Bottom-Sheet tippen → Lokal
- Name im Feed tippen → Lokal
- Herz im Feed → Zähler +1 und Herzschlag
- Scan-Tab → „Demo: Code erkannt" → Formular → „Bewertung senden" → Dank
- Profil → „Mein Restaurant" → Inhaber-Ansicht
- Zurück-Pfeil im Lokal → letzter Tab
