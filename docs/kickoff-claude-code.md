# Kickoff für Claude Code — Schritt 1: lauffähiges MVP

Dieses Dokument ist die Übergabe an Claude Code. Egor kopiert den Block „Erste Nachricht" unten 1:1 in Claude Code, nachdem das Repo verbunden ist.

## Was schon da ist (nicht neu bauen)
- `web/index.html` — Web-App v0.2, funktioniert ohne Build. Karte (Leaflet/OSM), Feed, Lokal, Scan-Flow, Gespeichert, Profil. Demo-Daten im `PLACES`-Array, Zustand in localStorage.
- `lib/data/freshness.ts` + `types.ts` — Frische-Regel und Datentypen (TypeScript, wiederverwenden).
- `CLAUDE.md` — Regeln, Datenmodell, was nicht getan wird.
- `docs/concept.md`, `docs/screens.md`, `design/tokens.md` — Produkt und Design.

## Entscheidungen (getroffen, nicht neu diskutieren)
- Web zuerst, mobile-first, PWA. Kein App-Store vor dem Bamberg-Test.
- Backend: **Supabase** (Postgres + Storage + Auth). Kostenloser Tarif reicht.
- Hosting: statisch (Vercel oder Netlify), Domain folgt in Schritt 2.
- Kein Login-Zwang. Karte und Lokal ohne Konto. Konto nur für Bewerten (Magic Link per E-Mail, kein Passwort) und für Inhaber.
- Bewertung nur nach QR-Scan (`visit`). Nie ohne.
- Name: Arbeitstitel bleibt „ON2U Eats", bis Egor den finalen Namen nennt. Name als eine Konstante, nirgends hart im Text.

## Definition of Done für Schritt 1
Egor kann in Bamberg:
1. die Web-App unter einer URL auf dem Handy öffnen und zum Home-Bildschirm legen,
2. ein echtes Lokal anlegen (Inhaber-Ansicht: Name, Adresse auf der Karte setzen, Speisekarte eintippen oder fotografieren),
3. für dieses Lokal QR-Codes als PDF drucken (Tisch 1–N, jeder mit eigenem Token),
4. als Gast den QR mit der Handykamera scannen → Bewertung abgeben → Punkt des Lokals ändert sich sofort,
5. ein kurzes Video hochladen, das im Feed und beim Lokal erscheint,
6. das Ganze auf Tablet und Laptop bedienen.

Nicht in Schritt 1: Bezahlen, Push, mehrere Sprachen, Reservierung, Kommentare.

## Subagenten (parallel starten)

| Agent | Auftrag | Ergebnis |
|---|---|---|
| **research** | TikTok Local Feed & Reviews-Tab, Google Maps Video-Reviews, BiteMap, Zest, JaiFaim: Was machen sie beim Onboarding von Lokalen, wie verifizieren sie, was kostet es? | `docs/research/competitors.md`, 1–2 Seiten, mit Datum |
| **backend** | Supabase-Projekt: Schema aus `CLAUDE.md` als SQL-Migration, View `place_freshness`, RLS (Gäste lesen alles, schreiben nur eigene visits/reviews; Inhaber schreiben nur eigene places), Storage-Bucket `videos` mit 50 MB Limit, Edge Function `verify-qr(token)` → `visit`. | `supabase/migrations/*.sql`, `supabase/functions/`, `docs/backend.md` |
| **frontend** | `web/` auf Vite + TypeScript umbauen, Struktur `src/screens/*`, `src/lib/api.ts` (Supabase-Client), Demo-Daten raus, echte Daten rein. QR-Erkennung mit `BarcodeDetector`, Fallback `jsqr`. Video-Upload mit Fortschritt. Inhaber-Onboarding (4 Schritte). QR-PDF mit `pdf-lib`. | lauffähiges `web/`, `npm run dev` und `npm run build` |
| **qa** | Nach Merge: auf iPhone Safari, Android Chrome, iPad, Desktop durchklicken (Playwright für Desktop, manuell-Checkliste für Mobile). Alle Texte deutsch, keine „Lorem", keine Demo-Reste. | `docs/qa-checklist.md` mit Ergebnis |

Reihenfolge: research und backend sofort, frontend sobald das Schema steht (nicht auf research warten), qa zum Schluss.

## Erste Nachricht an Claude Code (kopieren)

```
Прочитай CLAUDE.md, затем docs/kickoff-claude-code.md. Это проект ON2U Eats — карта ресторанов, где цены подтверждены.

Все решения уже приняты, не обсуждай их заново. Запусти субагентов research, backend, frontend и qa как описано в kickoff. Цель — Definition of Done из kickoff: рабочий MVP, который я могу открыть на телефоне и протестировать в Бамберге с реальными ресторанами.

Для Supabase: создай проект через CLI, положи ключи в .env.example (без значений) и скажи мне, какие два значения вставить в .env. Ничего не деплой без моего подтверждения. В конце дай мне список: что работает, что не успел, какие команды запускать.

Общайся со мной по-русски, код на английском, тексты интерфейса на немецком.
```
