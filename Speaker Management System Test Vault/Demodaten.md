# Demodaten

Dieser Vault enthält einen vollständigen, erfundenen Datensatz: den
**Assistenz Summit 2026** zum Thema „Die Zukunft der Vorstandsassistenz",
ausgerichtet von Acme Events am 4. und 5. November 2026.

Der Datensatz bildet **genau die beiden UI-Entwürfe** in `docs/ui/` ab. Wer die
Sichten baut, kann sein Ergebnis direkt daneben halten.

## Was drin ist

| | |
|---|---|
| 13 Speaker | im konferenzübergreifenden Katalog |
| 1 Veranstalter | Acme Events |
| 1 Konferenz | zwei Tage mit unterschiedlichem Raster |
| 13 Engagements | über alle acht Status verteilt |
| 18 Beiträge | 15 im Raster, 2 im Pool, 1 heimatlos |

## Welche Fälle absichtlich vorkommen

- **Alle vier Slot-Zustände.** Gefüllt und zugesagt (grün), auf Verdacht platziert
  (Speaker noch nicht zugesagt), halb gefüllt (Thema ohne Speaker *und* Speaker ohne
  Thema), und sechs freie Slots.
- **Ein titelloser Beitrag** — Yannick Sobotta hat den Slot Mi 12:00 Track B, das
  Thema kommt später. Die Notiz heißt entsprechend vorläufig.
- **Ein heimatloser Beitrag** — der Workshop „Netzwerken auf Vorstandsebene" zeigt auf
  Track `t4`, den es seit der Streichung von Track D nicht mehr gibt.
- **Zwei Beiträge im Pool** ohne Slot, einer davon ohne Speaker.
- **Speaker mit mehreren Beiträgen** — sechs der Speaker liefern je zwei.
- **Ein plenarer Block** (die Keynote) über alle Tracks.
- **Ein Beitrag mit Titel, aber ohne Speaker** — das Panel am Tagesende.
- **Zwei gestrichene Engagements** mit ihrer Begründung.
- **Checklisten in jedem Reifegrad.** Jedes Engagement hat vier Punkte (Bio, Foto,
  Vertrag, Reisekosten), jeder Beitrag drei (Abstract, Folien, Technikbedarf).
  Zusammengezählt ergibt das je Speaker 10/10, 9/10, 6/10, 4/10, 3/10 und unberührt.
- **Nur ein einziger Speaker ist inhaltlich fertig** — Marek Lindqvist, 10 von 10. Alle
  anderen haben irgendwo ein offenes Häkchen.
- **Rechnung gestellt, Folien fehlen** — Petra Vahlbruch steht in der Spalte `rechnung`
  und ist mit 9/10 trotzdem nicht fertig. Die beiden Achsen laufen unabhängig.
- **Alle drei Stufen der Raum-Kaskade.** Jeder Track hat einen Raum, die Keynote
  überschreibt ihn für ihren plenaren Block, und der Workshop um 14:00 zieht als
  einzelner Slot in den Raum Werft. Tag 2 erbt stillschweigend vom Track.
- **Ein Beitrag, der nicht in seinen Raum passt** — „Workshop: Protokoll in 15 Minuten"
  ist auf 40 Teilnehmende angelegt, der Raum Speicher fasst 30. Genau darauf soll die
  Prüfung anspringen.
- **Ein zweiter Tag mit anderem Raster** — nur ein Track, zwei lange Blöcke, noch leer.

## Kennzahlen, die stimmen sollten

- Honorarsumme **18.400 €** von 25.000 € Budget — aus sechs Engagements: 4.000 €,
  3.400 €, 3.000 €, 2.900 €, 2.700 €, 2.400 €. Die übrigen sieben tragen keinen Betrag,
  darunter Sonja Ehrlich, mit der noch verhandelt wird.
- 21 Slots, davon 15 belegt und 6 frei
- 11 aktive Kandidaten, 2 gestrichen
- 1 von 11 Kandidaten inhaltlich fertig — alle Häkchen im Engagement und in beiden
  Beiträgen

Weichen die Sichten davon ab, stimmt etwas in der Projektion nicht.

## Titel mit Doppelpunkt

Mehrere Workshops heißen `Workshop: …`. Obsidian verbietet den Doppelpunkt in
Dateinamen, deshalb heißen die Dateien ohne ihn, während das Feld `titel` den
vollständigen Titel trägt. Dateiname und Titel dürfen auseinandergehen — die Sichten
zeigen immer `titel`.
