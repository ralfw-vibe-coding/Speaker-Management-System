# Demodaten

Dieser Vault enthält einen vollständigen, erfundenen Datensatz: den
**Assistenz Summit 2026** zum Thema „Die Zukunft der Vorstandsassistenz",
ausgerichtet von Acme Events am 4. und 5. November 2026. Daneben steht der
gelaufene **Assistenz Summit 2025**, damit der Katalog eine Vergangenheit hat.

Der Datensatz bildet **genau die beiden UI-Entwürfe** in `docs/ui/` ab. Wer die
Sichten baut, kann sein Ergebnis direkt daneben halten.

## Was drin ist

| | |
|---|---|
| 13 Speaker | im konferenzübergreifenden Katalog, 11 davon mit `wahl` je Thema |
| 1 Veranstalter | Acme Events |
| 3 Konferenzen | 2026 in Planung, 2025 gelaufen, 2027 erst eine Idee |
| 18 Engagements | 13 in der Konferenz 2026, 5 in der von 2025 |
| 26 Beiträge | 18 in der Konferenz 2026, 8 in der von 2025 |

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
- **Ein Beitrag, der nicht in seine Zeit passt** — „Workshop: Der perfekte Board-Report"
  braucht 90 Minuten und liegt in einem 45-Minuten-Block. Zweimal auf ⤓ heilt es.
  „Workshop: Netzwerken auf Vorstandsebene" braucht drei Stunden und passt damit nur an
  Tag 2 — dort dauern die Blöcke genau so lang.
- **Ein zweiter Tag mit anderem Raster** — nur ein Track, zwei lange Blöcke, noch leer.
- **Eine gelaufene Konferenz mit vollständigem Programm.** Der Summit 2025 behält
  Raster und Beiträge; das Programm bleibt Jahre später lesbar. Sein Raster ist kleiner
  als das von 2026: zwei Tracks, ein Workshoptag, acht Slots, alle belegt.
- **Eine Konferenz, die nur eine Idee ist.** Der Summit 2027 hat weder Termin noch
  Raster noch Kandidaten — kein `tracks`, kein `tage`. Das Lesen muss das verkraften,
  ohne sich zu verschlucken, und die Sichten müssen etwas Vernünftiges anzeigen.
- **Fünf Speaker mit Historie**, alle auch 2026 wieder im Spiel: Vahlbruch, Lindqvist,
  Ostrowski, Nowak und Ehrlich. Vier davon mit Bewertung, Ehrlich ohne — sie war
  gestrichen und gar nicht da.
- **Eine schlechte Bewertung mit Folgen.** Christa Nowak hat 2025 zwei Sterne bekommen,
  weil die Zusammenarbeit zäh war; 2026 wartet man wieder seit acht Wochen auf ihre
  Antwort. Das Muster soll im Katalog sichtbar werden.

## Kennzahlen, die stimmen sollten

- 180 erwartete Gäste — der Maßstab für die Plätze je Blockzeile. Die Workshop-Zeilen
  bleiben deutlich darunter, die Vortragszeilen liegen darüber.
- Honorarsumme **18.400 €** von 25.000 € Budget — aus sechs Engagements: 4.000 €,
  3.400 €, 3.000 €, 2.900 €, 2.700 €, 2.400 €. Die übrigen sieben tragen keinen Betrag,
  darunter Sonja Ehrlich, mit der noch verhandelt wird.
- 21 Slots, davon 15 belegt und 6 frei
- 11 aktive Kandidaten, 2 gestrichen
- 1 von 11 Kandidaten inhaltlich fertig — alle Häkchen im Engagement und in beiden
  Beiträgen

Weichen die Sichten davon ab, stimmt etwas in der Projektion nicht.

## Kennzahlen für den Speakerkatalog

- **13 Speaker**, davon 11 mit einer `wahl`, 2 noch nicht eingeschätzt
  (Falkenrath, Brehmer)
- 8 Speaker sind zu mindestens einem Thema **erste Wahl**
- Filter **Format**: 11 halten Vorträge, 6 machen Workshops, 3 Keynotes, 2 sitzen auf
  Panels, 1 moderiert
- 10 Speaker haben einen `honorarrahmen`, 10 eine Telefonnummer, alle 13 eine `rolle`
- Filter **Zielgruppe**: 7 für Vorstandsassistenz, 5 für Teamassistenz, 5 für
  Führungskräfte, 5 für Erfahrene, je 3 für Office-Management und Einsteiger
- Filter **Sprache**: 13 deutsch, 5 englisch, je einer polnisch und türkisch
- Filter **Thema `ki`**: zwei Treffer — Sobotta als erste, Ostrowski als zweite Wahl
- **Historie**: 5 Speaker haben einen Auftritt 2025, 4 davon mit Sternen
  (5, 4, 4, 2), Ehrlich ohne

## Kennzahlen des Summits 2025

- Honorarsumme **8.600 €** von 12.000 € Budget, aus vier bezahlten Engagements
- 5 Engagements, davon 4 bezahlt und 1 gestrichen
- 8 Slots, alle belegt — keine Löcher, nichts im Pool
- 8 Beiträge, je zwei auf die vier Speaker verteilt
- alle Checklisten durch: je Speaker 10 von 10

## Titel mit Doppelpunkt

Mehrere Workshops heißen `Workshop: …`. Obsidian verbietet den Doppelpunkt in
Dateinamen, deshalb heißen die Dateien ohne ihn, während das Feld `titel` den
vollständigen Titel trägt. Dateiname und Titel dürfen auseinandergehen — die Sichten
zeigen immer `titel`.
