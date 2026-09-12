# Konzept

## Position (Stand 11.09.2026)

Wir bauen kein zweites TikTok und kein zweites Google Maps. Beide gibt es, beide sind gut, beide bewegen sich bereits auf „Video + Ort" zu (TikTok Local Feed, Reviews-Tab; Google Maps Video-Reviews). Dagegen gewinnt man nicht.

Was keiner von beiden löst: **Stimmt die Speisekarte heute?** Google hat die Karte, aber sie ist Monate alt. TikTok hat das Video, aber keinen Preis. Zest (USA) bestätigt den Besuch über Kartenzahlung, fragt aber nie „stimmen die Preise?".

**ON2U Eats ist die Karte, auf der die Preise stimmen.** Bestätigt vom Inhaber und von Gästen, die nachweislich am Tisch saßen. Alles andere (Feed, Videos, Route) übernehmen wir als bekannte Muster, damit niemand etwas Neues lernen muss.

Rangfolge der Funktionen:
1. Grüner Punkt „Karte aktuell" und die Preis-Frage beim Scan — **das Produkt**
2. Karte mit Pins — der Einstieg
3. Lokal-Detail mit Speisekarte — die Entscheidung
4. Feed — Stöbern, sekundär; wenn TikTok das besser macht, ist das in Ordnung

Wo wir gewinnen: dort, wo Google und TikTok keine Daten haben. Albanien, Montenegro, Kleinstädte. Bamberg ist der Test, der Balkan das Ziel.

## Zwei Nutzergruppen, eine App

**Gast** (Tourist oder Einheimischer)
Will in unter 30 Sekunden wissen: Was gibt es hier in der Nähe, wie sieht es aus, was kostet es wirklich, lohnt es sich.

**Inhaber** (Restaurant, Bar, Café, Imbiss)
Will ohne Aufwand gefunden werden. Kein Google-Business-Gefrickel, keine Agentur. Karte aktualisieren = ein Foto machen. Video hochladen = wie eine Story.

Beide leben in derselben App. Im Profil gibt es den Schalter „Ich als Gast / Mein Restaurant". Kein separates Inhaber-Portal, das niemand öffnet.

## Die vier Kern-Flows

### 1. Finden (Karte)
Karte → Pins mit Namen → Bottom-Sheet mit Karten zum Wischen → Tippen → Lokal.
Filter-Chips oben: Alle, Jetzt offen, Bier, Café. Später: Preis, Draußen, Kinder.
Pins in Terrakotta = Karte aktuell (pulsierend). Graue Pins = ungeprüft. So sieht man auf einen Blick, wem man trauen kann.

### 2. Stöbern (Feed)
Vertikaler Video-Feed wie TikTok, aber gefiltert auf Umgebung. Drei Tabs oben: Folge ich, Bamberg (Standort), Beliebt.
Jeder Post zeigt sofort: Name, Kategorie, Entfernung, Bewertung, Badge „Karte aktuell". Rechts: Herz, Merken, Route.
Videos kommen von Inhabern (Tagesgericht, Küche, Team) und von Gästen (nur nach bestätigtem Besuch).

### 3. Lokal (Detail)
Video-Hero mit Thumbnails → Name, Bewertung, Kategorie, Entfernung → **Bestätigungs-Block** (grün: „Speisekarte bestätigt, vor 2 Tagen, vom Inhaber und 4 Gästen" / gelb: „ungeprüft, Preise können abweichen") → Speisekarte mit Preisen → zwei Buttons: „Am Tisch scannen", „Route" → Gäste-Videos → Mini-Karte.

### 4. Bestätigen (Scan + Bewertung)
QR-Code am Tisch scannen → „Besuch bestätigt" → 5 Herzen → **„Stimmen die Preise mit der Karte in der App?" Ja / Nein** → Tags → optional 30-Sekunden-Video → Senden → Dank mit Herzschlag-Animation.

Die Preis-Frage ist der Kern. Jedes „Ja" verlängert den grünen Punkt des Lokals. Drei „Nein" in einer Woche → Punkt wird gelb, Inhaber bekommt eine Nachricht. So bleibt die Karte ohne Redaktion aktuell.

## Prinzipien

- **Ehrlichkeit vor Reichweite.** Bewertungen nur mit Scan. Lieber 30 echte als 300 gekaufte.
- **Eine Aktion pro Screen.** Karte: Finden. Feed: Stöbern. Lokal: Entscheiden. Scan: Bestätigen.
- **Der grüne Punkt ist das Produkt.** Alles andere gibt es woanders auch.
- **Ruhe statt Lärm.** Dunkler warmer Hintergrund, Terrakotta nur für Aktionen und Herzen. Kein Konfetti, keine Neonfarben. Der Herzschlag aus ON2U ist das einzige Motiv.
- **Deutsch, wie man spricht.** „Danke." statt „Vielen Dank für Ihre Bewertung." „Karte ungeprüft" statt „Aktualitätsstatus unbekannt".

## Was wir in Bamberg lernen wollen

Vor dem Programmieren mit 3–5 Gastronomen den Prototyp durchgehen. Fragen:

1. Würdest du deine Speisekarte hier pflegen, wenn es 2 Minuten dauert? Was hält dich ab?
2. Was hältst du von Gästen, die Videos bei dir aufnehmen?
3. Würdest du QR-Codes auf die Tische legen? Wo genau?
4. Wenn ein Gast sagt „Preise stimmen nicht" — willst du das sehen, und wie schnell?
5. Was wäre dir das wert pro Monat (später, nicht jetzt)?

Und mit 10 Gästen (Freunde, Familie, Fremde am Domplatz):

1. Karte oder Feed — was öffnest du zuerst?
2. Verstehst du den grünen Punkt ohne Erklärung?
3. Würdest du am Tisch scannen? Warum nicht?

## Offen, bewusst noch nicht entschieden

- Name: „ON2U Eats" ist der Arbeitstitel. Verbindung zur Marke ON2U ist Stärke (bekannt, Stil) und Risiko (Streetwear-Brand für eine Gastro-App?). Entscheidung nach Bamberg-Test.
- Monetarisierung: erst nach Nutzern. Kandidaten stehen im Chat vom 10.09.: Inhaber-Abo, Platzierung, später Reservierung.
- Technik: React Native + Expo (Wissen aus der ON2U-App vorhanden) vs. Web-App zuerst (schneller testbar, kein App-Store).
