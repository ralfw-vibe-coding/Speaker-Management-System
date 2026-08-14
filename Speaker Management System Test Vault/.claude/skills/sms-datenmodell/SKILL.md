---
name: sms-datenmodell
description: Die Feldreferenz der Notizen im Speaker Management System (SMS) — welche Frontmatter-Felder ein Speaker, Veranstalter, eine Konferenz, ein Engagement und ein Beitrag tragen, welche Werte zulässig sind, wie Checklisten gezählt werden und vor allem, wie das Agenda-Raster einer Konferenz (Tage, Tracks, Blöcke, Slots) als verschachteltes YAML im Frontmatter kodiert ist. Verwenden, bevor eine dieser Notizen gelesen, ausgewertet oder geschrieben wird, und immer dann, wenn es um Slots, Blöcke, Tracks, den Funnel-Status oder das Honorar geht.
---

# SMS – Datenmodell

Die Notizen sind die einzige Wahrheit; es gibt keinen Datenspeicher daneben.
Strukturiertes steht im YAML-Frontmatter, Freitext im Body, Beziehungen sind Wikilinks.

## Zuerst: YAML, nicht JSON

Das gesamte Frontmatter ist YAML — auch das Raster einer Konferenz mit seinen
verschachtelten Listen. Obsidians Eigenschaften-Panel stellt verschachtelte Werte
JSON-artig dar (`[{"id":"t1","name":"…"}]`), aber in der Datei steht:

```yaml
tracks:
  - id: t1
    name: "Rolle & Zukunft"
```

YAML erlaubt für kurze Einträge auch die Flow-Schreibweise, die wie JSON aussieht und
oft benutzt wird — beides ist dasselbe:

```yaml
bloecke:
  - { id: b1, von: "09:00", bis: "09:30", plenar: true }
```

Uhrzeiten **immer in Anführungszeichen**. Ohne sie liest YAML `09:00` als Sexagesimalzahl
oder als ungültigen Wert. Namen mit `&`, `:` oder führendem `[` ebenfalls quoten.

Ein Fehler im Frontmatter zerlegt nicht ein Feld, sondern den ganzen Block: Die Konferenz
verliert dann auch Veranstalter, Budget und Deadline. Nach jedem Schreibzugriff prüfen,
ob das Frontmatter noch parst.

## Gemeinsames

- `type` ordnet die Notiz einem der fünf Typen zu: `speaker`, `veranstalter`,
  `konferenz`, `engagement`, `beitrag`. Fehlt oder passt der Wert nicht, ist die Notiz
  für alle Sichten unsichtbar.
- Verweise sind Wikilinks in Anführungszeichen: `veranstalter: "[[Acme Events]]"`.
  Gelesen wird der Name zwischen den Klammern; ein Alias (`[[Name|Anzeige]]`) wird
  toleriert.
- **Der Dateiname ist die Identität.** Er darf keines dieser Zeichen enthalten:
  `* " \ / < > : | ? # ^ [ ]`. Ein Beitrag mit dem Titel `Workshop: Kalender-Triage`
  heißt als Datei deshalb `… – Workshop Kalender-Triage.md`, während `titel` den
  vollständigen Titel trägt. Dateiname und Titel dürfen auseinandergehen.
- Fehlende Felder sind erlaubt. Wer liest, muss damit rechnen; wer schreibt, fasst nur
  an, was er ändern will.

## Checklisten

Engagements und Beiträge tragen im Body eine Checkliste unter der Überschrift
**`## Zu klären`**:

```markdown
## Zu klären
- [x] Bio erhalten
- [ ] Vertrag zurück
```

Gezählt werden alle Tasks unterhalb dieser Überschrift bis zur nächsten Überschrift
gleicher oder höherer Ebene. Der Wortlaut der Punkte ist frei, die Überschrift nicht.
Der Fortschritt wird nirgends gespeichert.

---

## speaker

Konferenzübergreifend, das Langzeitkapital. Dateiname ist der blanke Personenname.

| Feld | Typ | Bedeutung |
|---|---|---|
| `type` | `speaker` | |
| `rolle` | Text | Funktion oder Firma, erscheint auf der Katalogkarte |
| `email`, `telefon`, `web` | Text | Kontakt |
| `zielgruppe` | Liste | für wen der Mensch passt; im Katalog ein Filter |
| `themen` | Liste Text | Freies Vokabular, keine feste Liste |
| `wahl` | Zuordnung Thema → Zahl | Erste/zweite/dritte Wahl **je Thema** (1, 2, 3) |
| `formate` | Liste | aus `keynote`, `vortrag`, `workshop`, `panel`, `moderation` |
| `sprachen` | Liste Text | z. B. `[de, en]` |
| `ort` | Text | für die Einschätzung von Reisekosten |
| `honorarrahmen` | Zahl | Richtwert je Auftritt, **keine** Vereinbarung |

`wahl` ist eine Zuordnung, keine Liste — die Wahl gilt für ein Thema, nicht für die
Person. Themen ohne Eintrag sind schlicht nicht eingeschätzt.

```yaml
---
type: speaker
rolle: Beraterin
themen: [chief-of-staff, führung]
zielgruppe: [vorstandsassistenz, führungskräfte]
wahl:
  chief-of-staff: 1
  führung: 2
formate: [keynote, vortrag]
sprachen: [de, en]
ort: Zürich
honorarrahmen: 2500
---
## Profil
Freitext.

## Notizen
Die erste Zeile hier erscheint als Vorschau auf der Katalogkarte.
```

## veranstalter

Der Auftraggeber. Das Plugin nutzt bisher nur den Dateinamen; alles Weitere ist
Freitext im Body und darf frei erweitert werden.

```yaml
---
type: veranstalter
ansprechpartner: Maria Kern
email: kern@example.com
---
## Konditionen
Zahlungsziel, Reisekostenregelung, wer die Verträge schließt.
```

## konferenz

Trägt die Stammdaten **und das Raster**. Dateiname = Konferenzname; er ist das Präfix
aller Engagements und Beiträge dieser Konferenz.

| Feld | Typ | Bedeutung |
|---|---|---|
| `type` | `konferenz` | |
| `untertitel` | Text | thematischer Zusatz im Kopf der Sichten |
| `veranstalter` | Wikilink | |
| `status` | `idee`, `planung`, `programm-steht`, `gelaufen`, `abgesagt` | |
| `honorarbudget` | Zahl | Rahmen, gegen den die Engagement-Honorare laufen |
| `teilnehmer` | Zahl | erwartete Gäste; Maßstab für die Plätze je Block |
| `deadline_programm` | Datum `JJJJ-MM-TT` | |
| `tracks` | Liste | die Spalten des Rasters, konferenzweit |
| `tage` | Liste | je Tag die Zeilen des Rasters |
| `slots` | Liste | **nur Ausnahmen** von Raum und Kapazität |

Die **Plätze eines Slots** sind das Minimum aus `max_teilnehmer` des Beitrags und der
`kapazitaet` seines Raums — der Wunsch gegen die Wand. Je Blockzeile werden sie
aufsummiert: So viele Gäste nimmt das Programm zu dieser Zeit auf. Leere Slots zählen
nicht mit, ein Raum ohne Beitrag ist kein Angebot. Gerechnet, nirgends gespeichert.

Bei `gelaufen` und `abgesagt` gilt das Programm als Archiv: Die Agenda ist gesperrt, die
Statustafel bleibt bedienbar, weil Rechnungen und Zahlungen erst danach kommen.

### Das Raster

Ein **Track** ist eine parallele Programmlinie, also eine Spalte. Tracks werden
konferenzweit definiert; jeder Tag wählt aus, welche bei ihm laufen.

```yaml
tracks:
  - id: t1
    name: "Rolle & Zukunft"
    raum: "Saal Hanse"
    kapazitaet: 400
```

Ein **Block** ist eine Zeile: alle Beiträge verschiedener Tracks zur selben Zeit.

```yaml
tage:
  - datum: 2026-11-04
    tracks: [t1, t2, t3]
    bloecke:
      - { id: b1, von: "09:00", bis: "09:30", plenar: true }
      - { id: b2, von: "09:30", bis: "10:00", fix: "Ankommen & Kaffee" }
      - { id: b3, von: "10:00", bis: "10:45" }
      - { id: b4, von: "13:00", bis: "16:00", nur: [t3] }
```

| Block-Feld | Bedeutung |
|---|---|
| `id` | **konferenzweit eindeutig**, nicht nur je Tag |
| `von`, `bis` | Uhrzeit als Text in Anführungszeichen |
| `plenar: true` | belegt alle Tracks des Tages; ergibt genau **einen** Slot ohne Track |
| `fix: "…"` | Programmpunkt ohne Speaker (Pause, Registrierung, Abendprogramm) — erzeugt keine Slots |
| `nur: [t3]` | schränkt den Block auf bestimmte Tracks ein |

**Ein Slot ist der Kreuzungspunkt von Block und Track, und seine Identität ist das Paar
`(Block-ID, Track-ID)`.** Die Uhrzeit ist ein Attribut des Blocks, nicht Teil der
Identität — deshalb darf ein Block zeitlich verschoben werden, ohne dass Beiträge ihren
Platz verlieren. Eine Block-ID darf man aus demselben Grund **nie** ändern.

Der leere Slot ist kein Datenobjekt, sondern ein Loch: Kreuzprodukt aus Blöcken und
Tracks eines Tages, minus Fixblöcke, minus Belegtes.

### Raum und Kapazität

Beide sind optional und stehen dort, wo sie gelten — am Track, weil ein Track in aller
Regel den ganzen Tag derselbe Raum ist. `slots` trägt nur die Ausnahmen:

```yaml
slots:
  - { block: b1, raum: "Saal Hanse", kapazitaet: 400 }   # ganze Blockzeile, auch plenar
  - { block: b9, track: t3, raum: "Raum Werft", kapazitaet: 20 }   # genau ein Slot
```

Der speziellere Eintrag gewinnt: erst `(block, track)`, dann `block` allein, dann der
Track. Der Eintrag ohne `track` deckt auch den plenaren Slot ab, der von keinem Track
erbt. Fehlt alles, hat der Slot keinen Raum — das ist der Normalfall am Anfang.

## engagement

Die Beziehung Speaker × Konferenz. Trägt den Funnel und das Honorar.

| Feld | Typ | Bedeutung |
|---|---|---|
| `type` | `engagement` | |
| `konferenz`, `speaker` | Wikilink | |
| `status` | siehe unten | die Spalte auf der Statustafel |
| `position` | Zahl ab 0 | die Zeile innerhalb dieser Spalte |
| `honorar` | Zahl | für **das ganze Paket**, nicht je Beitrag |
| `bewertung` | Zahl | Sterne, nach der Konferenz vergeben |
| `angefragt_am`, `geantwortet_am` | Datum | |

`status` läuft durch: `gemerkt` → `angefragt` → `geantwortet` → `verhandlung` →
`zugesagt` → `rechnung` → `bezahlt`. Daneben steht `gestrichen` als Ausgang, den man
aus jeder Spalte nimmt. Die Reihenfolge ist im Plugin festgelegt, nicht in den Daten.

`position` zählt von 0 bis n **innerhalb einer Spalte einer Konferenz**. Nichts sortiert
sich von selbst; beim Umsortieren wird die betroffene Spalte neu durchnummeriert. Lücken
und doppelte Nummern werden beim Lesen vertragen.

Das Honorar hängt hier und nicht am Beitrag: Verhandelt wird mit dem Menschen über das
Paket, eine Aufteilung auf einzelne Beiträge wäre erfunden.

## beitrag

Was in einem Slot stattfindet — oder noch keinen Slot hat.

| Feld | Typ | Bedeutung |
|---|---|---|
| `type` | `beitrag` | |
| `konferenz` | Wikilink | |
| `speaker` | Liste von Wikilinks | darf leer sein; das Plugin schreibt genau einen |
| `titel` | Text | darf fehlen |
| `format` | `keynote`, `vortrag`, `workshop`, `panel`, `moderation` | |
| `dauer` | Zahl (Minuten) | **gewünschte** Dauer; die tatsächliche ergibt sich aus den Blöcken |
| `max_teilnehmer` | Zahl | wird gegen die Kapazität des Slots geprüft |
| `block` | Text **oder** Liste | leer = im Pool; mehrere = der Beitrag läuft über mehrere Blöcke |
| `track` | Text | entfällt bei plenaren Blöcken |

```yaml
---
type: beitrag
konferenz: "[[Assistenz Summit 2026]]"
speaker: ["[[Dr. Antje Rohleder]]"]
titel: "Die Assistenz als Chief of Staff"
format: keynote
block: b1
track:
---
```

`block` verträgt einen einzelnen Wert wie eine Liste — der Normalfall ist ein Wert.

### Die Reifegrade eines Beitrags

Slot und Beitrag sind dasselbe Ding in verschiedenen Reifegraden. Beide Felder dürfen
einzeln fehlen, und beide Richtungen kommen vor:

| Zustand | Bedeutung |
|---|---|
| `titel` gesetzt, `speaker` leer | Thema steht, Person offen |
| `speaker` gesetzt, `titel` leer | Person steht, Thema offen |
| beides gesetzt | inhaltlich vollständig — grün wird der Slot aber erst, wenn das Engagement auf `zugesagt` oder weiter steht |
| `block` leer | liegt im Pool, hat noch keinen Ort |
| `block` oder `track` zeigt ins Leere | **heimatlos**: Der Slot ist weggefallen, der Beitrag bleibt erhalten |

Ein titelloser Beitrag trägt einen vorläufigen Dateinamen aus Wochentag, Uhrzeit und
Track und wird umbenannt, sobald ein Titel da ist.

---

## Was gerechnet und nie gespeichert wird

Honorarsumme je Konferenz · Anzahl belegter und freier Slots · Checklisten-Fortschritt ·
die Historie eines Speakers (seine Backlinks) · heimatlose Beiträge · Doppelbelegungen ·
ob ein Speaker zur selben Zeit in zwei Tracks steht.

Solche Werte zusätzlich ins Frontmatter zu schreiben ist der häufigste Fehler: Sie
veralten beim nächsten Zug einer Karte, und dann widersprechen sich Notiz und Sicht.
