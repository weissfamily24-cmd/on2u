# Design-Tokens

Abgeleitet vom ON2U-Designsystem (Skill `on2u-app-developer`). Gleiche Basis wie die ON2U-Shop-App, damit beide Apps als eine Familie wirken.

## Farben

| Token | Hex | Verwendung |
|---|---|---|
| `bg` | `#0c0c0c` | Hintergrund. Warmes Schwarz, nicht eiskalt |
| `surface` | `#161412` | Karten, Sheets, Suchleiste |
| `surface-2` | `#1f1c19` | Platzhalter für Bilder/Video, sekundäre Buttons |
| `line` | `#2a2622` | Trennlinien, Rahmen |
| `text` | `#f0ece6` | Primärer Text, warmes Off-White |
| `text-2` | `#b8b1a8` | Sekundärer Text |
| `muted` | `#7d766e` | Labels, inaktive Tabs, ungeprüfte Pins |
| `accent` | `#c96a4a` | Terrakotta. **Nur** für: Scan-Button, primäre CTA, Herzen, aktive Pins, Scan-Linie |
| `accent-soft` | `#c4ad8e` | Gedämpftes Gold. Kursive Sätze, Warnungen („Karte ungeprüft"), Inhaber-Icons |
| `ok` | `#8fb08a` | Grün, gedämpft. Einzig für „Karte aktuell" und „Besuch bestätigt" |
| Wasser (Karte) | `#1e2a30` | Regnitz, nur auf der Karte |

Regel: Terrakotta höchstens an 2–3 Stellen pro Screen. Wenn ein Screen rot leuchtet, ist etwas falsch.

## Typografie

- **Poppins** 400 / 500 / 600 — alles Interface. Überschriften 600, Body 400, Labels 500.
- **Lora Italic** 400 — nur für Sätze mit Gefühl: Untertitel des Posts, „So wissen alle, dass du wirklich da warst.", Dank-Screen. Nie für Preise, Namen oder Buttons.

Größen: 24 (Lokal-Titel) · 22 (Screen-Titel) · 20 (Name im Feed) · 15 (Abschnitt) · 14 (Body, Buttons) · 13 (Meta) · 12 (Sekundär) · 11 (Badges, Tab-Labels)

## Form und Abstand

- Radius: 14 Karten · 12 Buttons und Blöcke · 999 Chips und Suche · 44 Phone-Rahmen
- Seitenrand 16, Abschnittsabstand 24, innerhalb von Blöcken 12
- Tab-Bar 78 hoch, Scan-Button 54 rund, erhoben um 30

## Motion (ein Motiv: Herzschlag)

- `pulse` — Ring um frische Pins, 2,4 s, ease-out, endlos, dezent
- `beat` — Herz beim Liken (0,6 s) und Dank-Screen (3 Schläge), scale 1 → 1,25 → 0,95 → 1
- `scanl` — Scan-Linie, 2,2 s hin und zurück
- Alles aus bei `prefers-reduced-motion`
- Nichts anderes bewegt sich. Keine Slide-Ins pro Abschnitt, keine Hover-Effekte.
