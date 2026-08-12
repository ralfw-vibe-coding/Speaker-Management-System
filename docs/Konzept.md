# SMS – Speaker Management System

Ein Obsidian-Plugin für das Content Management von Konferenzen: Speaker über Jahre
katalogisieren, je Konferenz durch einen Akquise-Funnel führen und ihre Beiträge in
die Tagesagenden einplanen.

---

## 1. Das Vorgehen, das abgebildet wird

1. **Auftrag** — Ich bekomme das Content Management für eine Veranstaltung. Ich lege
   Veranstalter und Konferenz an, dazu je Tag das Raster aus Blöcken und Tracks.
   Ab jetzt habe ich **Slots zu füllen**.
2. **Katalogpflege** — Ich recherchiere Speaker und trage sie in den Katalog ein,
   unabhängig von einer konkreten Konferenz.
3. **Kandidaten** — Aus dem Katalog picke ich Kandidaten für die Konferenz. Damit
   entsteht ein **Engagement** im Status `gemerkt`.
4. **Füllen** — Ich fülle Slots. Mal steht zuerst das Thema fest und der Speaker
   folgt später (typisch bei der Keynote), mal ist der Speaker klar und das Thema
   noch offen. Beide Richtungen sind gleichwertig.
5. **Fortschritt** — Die Agenda zeigt, wie voll das Programm ist. Die Statustafel
   zeigt, wie weit ich mit den Menschen bin. Beides bewegt sich auf Grün zu.

---

## 2. Domänenmodell

```
Veranstalter ──< Konferenz ──< Tag ──< Block ─┐
                     │          │             ├── Slot ──< Beitrag >── Speaker
                     │          └──< Track ───┘                │
                     └──< Engagement >────────────────────────-┘
```

| Begriff | Bedeutung |
|---|---|
| **Veranstalter** | Auftraggeber. Kommt über Jahre wieder, trägt wiederverwendbare Konditionen. |
| **Konferenz** | Eine Veranstaltung eines Veranstalters, bestehend aus Tagen. |
| **Tag** | Ein Konferenztag mit eigener **Agenda**. |
| **Track** | Parallele Programmlinie — eine Spalte im Raster. Konferenzweit definiert, je Tag ausgewählt. |
| **Block** | Zeitliche Zeile im Raster: alle Beiträge verschiedener Tracks zum selben Zeitpunkt. |
| **Slot** | Kreuzungspunkt von Block und Track. Der Arbeitsvorrat. |
| **Beitrag** | Was in einem Slot stattfindet: Keynote, Vortrag, Workshop. Hat Thema, Abstract, Honorar. |
| **Speaker** | Person im Katalog, konferenzübergreifend. Das Langzeitkapital. |
| **Engagement** | Die Beziehung Speaker × Konferenz. Trägt Funnel-Status, Verhandlungsnotizen, Checkliste. |

### Die tragenden Entscheidungen

**Der Slot ist zuerst da, nicht der Beitrag.** Das Raster steht ab Schritt 1. Slot und
Beitrag sind dasselbe Ding in verschiedenen Reifegraden — ein leerer Slot ist ein
Beitrag ohne Thema und ohne Speaker.

**Der leere Slot ist kein Datenobjekt**, sondern ein Loch: Kreuzprodukt aus Blöcken und
Tracks eines Tages, minus Fixblöcke, minus Belegtes. Sobald etwas eingetragen wird —
Thema *oder* Speaker — entsteht eine Beitragsnotiz.

**Die Identität des Slots ist das Paar `(Block-ID, Track-ID)`. Die Uhrzeit ist ein
Attribut des Blocks, nicht Teil seiner Identität.** Wird ein Block zeitlich verschoben,
ändert sich ein Attribut und alle Beiträge dieser Zeile wandern mit.

**Das Engagement ist ein eigenes Ding**, weil es einen eigenen Lebenszyklus hat: Der
Funnel-Status gehört weder dem Speaker (der überdauert) noch der Konferenz (die ist ein
Container). Nebeneffekt: Die Historie eines Speakers sind schlicht seine Backlinks.

**Zwei unabhängige Fortschrittsachsen.** Der Akquise-Status hängt am Engagement (man
verhandelt mit dem Menschen), die inhaltliche Reife am Slot. Ein Speaker mit zwei
Vorträgen hat ein Engagement und zwei Beiträge.

---

## 3. Datenhaltung

Alles sind Obsidian-Notizen: strukturierte Felder im YAML-Frontmatter, Freitext im
Body. Beziehungen sind Wikilinks — damit übernimmt Obsidian das Umbenennen, und es
braucht keine künstliche ID-Verwaltung. Die Daten bleiben ohne das Plugin lesbar,
editierbar und durchsuchbar.

Ordnerstruktur unterhalb eines konfigurierbaren Basisordners:

```
Speaker/Ralf Westphal.md
Veranstalter/Acme Events.md
Konferenzen/.NET Day 2026.md
Engagements/2026 .NET Day – Ralf Westphal.md
Beiträge/2026 .NET Day – Wieder mehr Substanz.md
```

### Speaker

```yaml
---
type: speaker
email: ralf@example.com
web: https://…
themen: [softwarearchitektur, clean-code, tdd]
formate: [keynote, vortrag, workshop]
sprachen: [de, en]
ort: Hamburg
---
## Profil
Bio, Eindrücke, „gut im Dialog, braucht langen Vorlauf".
```

### Veranstalter

```yaml
---
type: veranstalter
ansprechpartner: Maria Kern
email: kern@acme-events.de
telefon: +49 …
---
## Konditionen
Zahlungsziel 30 Tage, Reisekosten nach Beleg bis 400 €,
Verträge laufen über den Veranstalter.
```

### Konferenz

Tracks konferenzweit, Blöcke je Tag. Block-IDs sind innerhalb der Konferenz eindeutig.

```yaml
---
type: konferenz
veranstalter: "[[Acme Events]]"
status: planung          # idee | planung | programm-steht | gelaufen | abgesagt
deadline_programm: 2026-06-30
honorarbudget: 25000
tracks:
  - { id: t1, name: Hauptbühne }
  - { id: t2, name: Track B }
  - { id: t3, name: Workshop-Raum }
tage:
  - datum: 2026-11-04
    tracks: [t1, t2, t3]
    bloecke:
      - { id: b1, von: "09:00", bis: "10:00", plenar: true }
      - { id: b2, von: "10:15", bis: "11:00" }
      - { id: b3, von: "11:15", bis: "12:00" }
      - { id: b4, von: "12:00", bis: "13:00", fix: Mittagspause }
      - { id: b5, von: "13:00", bis: "16:00", nur: [t3] }
  - datum: 2026-11-05
    tracks: [t3]
    bloecke:
      - { id: b6, von: "09:00", bis: "12:00" }
---
## Ausrichtung
Thema, Zielgruppe, Ton — wonach ich Speaker auswähle.

## Mit dem Veranstalter zu klären
- [x] Honorarbudget bestätigt
- [ ] Anzahl Slots und Tracks final
- [ ] Reisekosten-Regelung
- [ ] Technik in den Workshop-Räumen
- [ ] Wer schließt die Verträge?
```

Block-Attribute: `plenar` belegt alle Tracks des Tages, `fix` ist ein Programmpunkt
ohne Speaker (Pause, Registrierung, Abendprogramm), `nur` schränkt den Block auf
bestimmte Tracks ein.

### Engagement

```yaml
---
type: engagement
konferenz: "[[.NET Day 2026]]"
speaker: "[[Ralf Westphal]]"
status: zugesagt
angefragt_am: 2026-03-01
geantwortet_am: 2026-03-04
rechnung_am:
bezahlt_am:
---
## Zu klären
- [x] Bio erhalten
- [x] Foto erhalten
- [ ] Abstract final
- [ ] Vertrag zurück
- [ ] Reisekosten geklärt

## Gesprächsnotizen
04.03. telefoniert, will lieber Freitag.
```

Die Checkliste sind normale Markdown-Tasks: Obsidian rendert echte Checkboxen, sie
lassen sich im Editor oder im Board abhaken, und das Plugin liest den Fortschritt nur
mit. Die Beiträge werden hier **nicht** gelistet — sie verlinken selbst auf Konferenz
und Speaker, das Plugin findet sie. So gibt es keine zwei Wahrheiten.

### Beitrag

```yaml
---
type: beitrag
konferenz: "[[.NET Day 2026]]"
speaker: ["[[Ralf Westphal]]"]   # darf leer sein
titel: Wieder mehr Substanz      # darf leer sein
format: keynote
honorar: 2500
block: b1                        # leer = im Pool
track:                           # entfällt bei plenaren Blöcken
---
## Abstract
…

## Für den Speaker
Technik-Wünsche, Vorstellungstext.
```

Die Dauer ergibt sich aus dem Block und wird nicht doppelt gepflegt.

---

## 4. Status

### Funnel am Engagement

```
gemerkt → angefragt → geantwortet → in Verhandlung → zugesagt → Rechnung → bezahlt ✅
                                                        ↓
                                                   gestrichen
```

`gestrichen` ist keine Spalte in der Reihe, sondern ein Ausgang, den man von überall
nimmt — ein eingeklapptes Fach am Rand.

In der Spalte **zugesagt** läuft die Checkliste als Fortschrittsbalken. Die Karte wird
grün, wenn alle Pflichtpunkte erledigt sind — das ist „inhaltlich fertig", noch vor der
Veranstaltung. Rechnung und Zahlung liegen zeitlich danach und sind deshalb eigene
Spalten. Die Rechnung hängt am Engagement, nicht am Beitrag: ein Speaker mit zwei
Vorträgen stellt eine Rechnung.

### Reifegrad am Slot

| Zustand | Anzeige |
|---|---|
| leer | Loch |
| nur Thema, Speaker offen | halb |
| nur Speaker, Thema offen | halb |
| Thema + Speaker, Engagement noch nicht zugesagt | „auf Verdacht platziert" |
| Thema + Speaker, Engagement zugesagt | grün |

Der Fortschritt eines Slots ist immer das **Minimum** aus eigener Füllung und dem
Status des zugehörigen Engagements.

### Drei Fertig-Begriffe

- **Agenda fertig** — keine Löcher, kein Beitrag mehr im Pool.
- **Speaker fertig** — alle Engagements zugesagt, alle Themen klar, Checklisten durch.
- **Ganz fertig** — alle Rechnungen bezahlt.

---

## 5. Sichten

**Speakerkatalog** — konferenzübergreifend. Suchen und filtern nach Thema, Format,
Sprache, Historie. Aktion: „als Kandidat für ⟨Konferenz⟩ merken".

**Statustafel** — je Konferenz. Kandidaten als Karten im Funnel, per Drag & Drop
zwischen den Spalten. Zeigt je Karte die Beiträge und den Checklisten-Fortschritt.

**Agenda** — je Konferenztag. Das Raster als Gitter, Tracks als Spalten, Blöcke als
Zeilen, jeder Slot mit Ampel. Daneben ein **Pool**: Beiträge ohne Ort — sowohl Themen,
die noch nirgends platziert sind, als auch heimatlose, die ihren Slot verloren haben
(mit Warnzeichen). Beiträge werden zwischen Pool und Gitter gezogen.

Statustafel und Agenda schauen aus verschiedenen Winkeln auf dieselben Daten, deshalb
muss von beiden Seiten gearbeitet werden können.

---

## 6. Regeln

- **Automatisches Engagement** — Wird im Slot ein Speaker zugewiesen, der noch kein
  Kandidat ist, entsteht sein Engagement automatisch im Status `gemerkt`.
- **Block verschieben** — Ändert nur das Zeit-Attribut des Blocks; alle Beiträge
  wandern mit, weil sie an der Block-ID hängen.
- **Track oder Block löschen** — Die betroffenen Beiträge werden nicht gelöscht,
  sondern **heimatlos** und landen sichtbar im Pool.
- **Streichen** — Alle Beiträge dieses Speakers in dieser Konferenz werden geleert, die
  Slots sind wieder Löcher, das Engagement wandert nach `gestrichen`. Welche Slots und
  Themen vorgesehen waren, bleibt als Spur im Engagement.
- **Honorar** — Summe der Beitragshonorare je Konferenz, gegen das `honorarbudget`.

### Was das Plugin prüft, ohne dass man fragt

Doppelbelegung eines Slots · derselbe Speaker in zwei parallelen Tracks · ein Beitrag,
dessen Format nicht in die Blockdauer passt · offene Slots · heimatlose Beiträge ·
Beiträge, deren Speaker noch nicht zugesagt hat.

---

## 7. Offene Punkte

- **Beiträge über mehrere Blöcke** — derzeit über lange Blöcke gelöst (`b5`, `b6`).
  Reicht das, oder braucht ein Beitrag eine Liste von Blöcken?
- **Mehrere Speaker je Beitrag** — im Format vorgesehen. Wie wird das Honorar dann
  aufgeteilt, und hat jeder ein eigenes Engagement?
- **Reisekosten** — eigenes Feld am Engagement oder Teil des Honorars?
- **Wiederverwendung** — soll beim Füllen eines Slots vorgeschlagen werden, welche
  Beiträge ein Speaker in früheren Jahren gehalten hat?
- **Bedarfsplanung** — lohnt ein Soll je Format („2 Keynotes, 12 Vorträge"), oder
  ergibt sich der Bedarf ohnehin schon vollständig aus dem Raster?
- **Feldnamen** — bleiben deutsch wie hier, oder englisch im Frontmatter?
```
