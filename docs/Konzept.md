# SMS – Speaker Management System

Ein Obsidian-Plugin für das Content Management von Konferenzen: Speaker über Jahre
katalogisieren, je Konferenz durch einen Akquise-Funnel führen und ihre Beiträge in
die Tagesagenden einplanen.

---

## 1. Das Vorgehen, das abgebildet wird

1. **Auftrag** — Ich bekomme das Content Management für eine Konferenz. Ich lege
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
| **Konferenz** | Das mehrtägige Ereignis eines Veranstalters, bestehend aus Tagen. |
| **Tag** | Ein Konferenztag mit eigener **Agenda**. |
| **Track** | Parallele Programmlinie — eine Spalte im Raster. Konferenzweit definiert, je Tag ausgewählt. Trägt meist auch Raum und Kapazität. |
| **Block** | Zeitliche Zeile im Raster: alle Beiträge verschiedener Tracks zum selben Zeitpunkt. |
| **Slot** | Kreuzungspunkt von Block und Track. Der Arbeitsvorrat. Erbt Raum und Kapazität vom Track, kann sie überschreiben. |
| **Beitrag** | Was in einem Slot stattfindet: Keynote, Vortrag, Workshop. Hat Thema, Abstract und eine eigene Checkliste. |
| **Speaker** | Person im Katalog, konferenzübergreifend. Das Langzeitkapital. |
| **Engagement** | Die Beziehung Speaker × Konferenz. Trägt Funnel-Status, Honorar, Verhandlungsnotizen, Checkliste. |

### Die tragenden Entscheidungen

**Es heißt Konferenz, nicht Veranstaltung.** Entschieden, nicht mehr offen. „Veranstaltung"
ist zu weit und schlösse ein Seminar ein; hier geht es um viele Slots, viele Speaker und
parallele Tracks. Der Begriff steckt in Feldnamen, Ordnernamen und Dateinamen und wird
nicht mehr angefasst — auch nicht durch ein beiläufiges „Veranstaltung" im Gespräch.
Einzig der **Veranstalter** behält seinen Namen; er ist der Auftraggeber, nicht das
Ereignis.

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

### Ordner

Alles Konferenzspezifische liegt im Ordner seiner Konferenz. Eine gelaufene Konferenz
archiviert man, indem man einen Ordner verschiebt. Die drei obersten Ordner sind in
den Plugin-Einstellungen konfigurierbar.

```
speaker/
  Ralf Westphal.md
veranstalter/
  Acme Events.md
konferenzen/
  .NET Day 2026/
    .NET Day 2026.md                          ← die Konferenz samt Raster
    engagements/
      .NET Day 2026 – Ralf Westphal.md
    beiträge/
      .NET Day 2026 – Wieder mehr Substanz.md
```

### Dateinamen

Obsidian löst Wikilinks über den **Dateinamen** auf, nicht über den Pfad. Zwei Dateien
`Ralf Westphal.md` in verschiedenen Ordnern machen `[[Ralf Westphal]]` mehrdeutig.
Deshalb muss jede Notiz vault-weit eindeutig heißen:

- **Speaker** tragen ihren blanken Namen — sie sind das, was man meint, wenn man die
  Person verlinkt.
- **Engagements und Beiträge** tragen den Konferenznamen als Präfix.

Das Präfix wirkt innerhalb des Konferenzordners redundant, verdient sich aber zweimal:
Es macht die Namen eindeutig, und es macht die **Backlink-Liste am Speaker zu seiner
Historie** — dort steht nur der Dateiname, nicht der Pfad. Auf der Notiz eines Speakers
liest man dann untereinander seine Auftritte über die Jahre.

Der Dateiname eines Beitrags ist sein Titel, bereinigt um die Zeichen, die Obsidian in
Notiznamen verbietet: `* " \ / < > : | ? # ^ [ ]`. Aus dem Titel
`Workshop: Der perfekte Board-Report` wird also die Datei
`… – Workshop Der perfekte Board-Report.md`. Der ungekürzte Titel steht im Feld
`titel` — Dateiname und Titel dürfen auseinandergehen.

Ein Beitrag darf titellos entstehen (Speaker steht, Thema offen). Er heißt dann
vorläufig `.NET Day 2026 – Beitrag Mi 12 Uhr Track B.md` und wird umbenannt, sobald ein
Titel da ist; Obsidian zieht die Links dabei mit.

### Wer die Dateien anlegt

Notizen entstehen **durch den View**, nicht von Hand. Das Plugin besitzt die Dateien:
Es legt sie an, benennt sie, garantiert eindeutige Namen und korrektes Frontmatter.
Damit braucht es keine Reparaturlogik für Zustände, die gar nicht erst entstehen.

Trotzdem gilt: **eng schreiben, tolerant lesen.** In die Notizen wird von Hand
hineingeschrieben — Gesprächsnotizen, Abstracts, ein Häkchen zwischendurch. Das Plugin
fasst beim Schreiben nur die Felder an, die ihm gehören, und lässt Body und Fremdfelder
unangetastet. Beim Lesen verträgt es ein fehlendes Feld, statt sich zu verschlucken.
Sonst wäre der Vorteil von Markdown wieder verspielt.

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
untertitel: Praxis statt Folien
veranstalter: "[[Acme Events]]"
status: planung          # idee | planung | programm-steht | gelaufen | abgesagt
deadline_programm: 2026-06-30
honorarbudget: 25000
tracks:
  - { id: t1, name: Hauptbühne, raum: Saal Hanse, kapazitaet: 400 }
  - { id: t2, name: Vertiefung, raum: Saal Elbe, kapazitaet: 150 }
  - { id: t3, name: Workshops, raum: Raum Speicher, kapazitaet: 30 }
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
slots:
  - { block: b1, raum: Saal Hanse, kapazitaet: 400 }
  - { block: b3, track: t3, raum: Raum Werft, kapazitaet: 20 }
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

Der `untertitel` ist der thematische Zusatz, der im Kopf der Sichten neben dem
Veranstalter und der Datumsspanne steht. Die Spanne selbst wird aus `tage` gerechnet
und nicht gepflegt.

#### Raum und Kapazität

Beide Angaben sind optional und stehen dort, wo sie gelten. Am **Track** stehen sie für
alle seine Slots — ein Track ist in aller Regel den ganzen Tag derselbe Raum. Die Liste
`slots` trägt nur die **Ausnahmen** davon, gelesen von unten nach oben:

| Eintrag | gilt für |
|---|---|
| `{ block, track, … }` | genau diesen einen Slot |
| `{ block, … }` | alle Slots dieser Zeile — und den plenaren Slot, der gar keinen Track hat |
| Track | alle Slots dieser Spalte |

Der speziellere Eintrag gewinnt. Fehlt alles, hat der Slot keinen Raum — das ist kein
Fehler, sondern der Normalfall am Anfang der Planung.

Der Eintrag ohne `track` verdient sich zweimal: Ein plenarer Block belegt alle Tracks
und erbt deshalb von keinem, er braucht seine eigene Angabe. Und wenn eine ganze Zeile
umzieht, ist es ein Eintrag statt drei.

`slots` steht auf Konferenzebene und nicht im Tag, weil Block-IDs konferenzweit
eindeutig sind und das Paar `(Block-ID, Track-ID)` den Slot schon vollständig
bezeichnet. Ein Eintrag hier ist **keine Slot-Notiz** — der leere Slot bleibt ein Loch
im Raster. Es ist eine Eigenschaft des Rasters, so wie die Uhrzeit eines Blocks.

### Engagement

```yaml
---
type: engagement
konferenz: "[[.NET Day 2026]]"
speaker: "[[Ralf Westphal]]"
status: zugesagt
position: 1
honorar: 3000
angefragt_am: 2026-03-01
geantwortet_am: 2026-03-04
rechnung_am:
bezahlt_am:
---
## Zu klären
- [x] Bio erhalten
- [x] Foto erhalten
- [ ] Vertrag zurück
- [ ] Reisekosten geklärt

## Gesprächsnotizen
04.03. telefoniert, will lieber Freitag.
```

Die Checkliste sind normale Markdown-Tasks: Obsidian rendert echte Checkboxen, sie
lassen sich im Editor oder im Board abhaken, und das Plugin liest den Fortschritt nur
mit. Die Beiträge werden hier **nicht** gelistet — sie verlinken selbst auf Konferenz
und Speaker, das Plugin findet sie. So gibt es keine zwei Wahrheiten.

Am Engagement steht, was **am Menschen** hängt und einmal je Konferenz anfällt: Bio,
Foto, Vertrag, Reisekosten. Was am einzelnen Beitrag hängt, steht dort — sonst könnte
ein Häkchen für jemanden mit zwei Vorträgen nicht stimmen.

**Das Honorar gehört ebenfalls hierher, nicht an den Beitrag.** Verhandelt wird mit dem
Menschen, und zwar über das Paket: Wer zwei Beiträge liefert und 3.000 € vereinbart, für
den ist es gleichgültig, ob davon rechnerisch 2.000 € auf den Vortrag und 1.000 € auf
den Workshop entfallen oder 1.500 € auf jeden. Eine Aufteilung wäre erfunden. Sie
stünde außerdem quer zu allem anderen: Eine Rechnung, ein Vertrag, ein Honorar. Das Feld
trägt den vereinbarten Betrag — oder, solange nicht zugesagt ist, den angebotenen.

### Beitrag

```yaml
---
type: beitrag
konferenz: "[[.NET Day 2026]]"
speaker: ["[[Ralf Westphal]]"]   # darf leer sein
titel: Wieder mehr Substanz      # darf leer sein
format: keynote
max_teilnehmer: 20               # optional, meist nur bei Workshops
block: b1                        # leer = im Pool
track:                           # entfällt bei plenaren Blöcken
---
## Zu klären
- [x] Abstract eingereicht
- [ ] Folien eingereicht
- [ ] Technikbedarf geklärt

## Abstract
…

## Für den Speaker
Technik-Wünsche, Vorstellungstext.
```

Die Dauer ergibt sich aus dem Block und wird nicht doppelt gepflegt.

Auf die Checkliste kommt nur, **wofür es kein Feld gibt.** Ob ein Titel da ist, steht in
`titel`, ob der Beitrag einen Platz hat, in `block` und `track` — dafür braucht es kein
Häkchen, das wäre eine zweite Wahrheit. Übrig bleiben die
Zulieferungen und Absprachen zum einzelnen Beitrag: Abstract, Folien, Technikbedarf. Der
Technikbedarf steht hier und nicht am Engagement, weil er am Format hängt: derselbe
Mensch braucht für die Live-Demo WLAN und für den Workshop bewegliche Stühle.

`max_teilnehmer` ist die Obergrenze, die der Beitrag selbst mitbringt — meist ein
Workshop, der in kleiner Runde stattfinden soll. Sie ist optional und hat nichts mit der
`kapazitaet` des Raums zu tun: die eine ist ein Wunsch, die andere eine Wand. Wo beide
gesetzt sind, vergleicht das Plugin sie.

**Ein Beitrag, ein Speaker.** Das Feld ist eine Liste, das Plugin schreibt aber immer
genau einen Namen hinein; es gibt keine Bedienung für einen zweiten, keine
Honoraraufteilung, keine Sollzahl an Plätzen. Weitere Beteiligte — Moderation, ein
Vorstand, den der Veranstalter mitbringt — stehen als Prosa im Body. Wer dort steht, hat
kein Engagement und damit auch keinen Vertrag und kein Honorar; braucht er beides, legt
man ihm ein eigenes Engagement an, das dann eben ohne Beitrag dasteht — mit seinem
eigenen Honorar, das dadurch ganz von selbst in der Summe landet. Gelesen wird trotzdem
tolerant: Stehen von Hand zwei Namen in der Liste, erscheint der Beitrag auf beiden
Karten.

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

Die Werte im Feld `status` heißen: `gemerkt`, `angefragt`, `geantwortet`,
`verhandlung`, `zugesagt`, `rechnung`, `bezahlt`, `gestrichen`. Ihre Reihenfolge steht
im Plugin, nicht in den Daten.

In der Spalte **zugesagt** läuft die Checkliste als Fortschrittsbalken. Gezählt werden
die Punkte unter der Überschrift `## Zu klären` im Engagement **und in allen Beiträgen
dieses Speakers in dieser Konferenz**. Die Karte wird grün, wenn alle abgehakt sind —
das ist „inhaltlich fertig", noch vor der Konferenz. Sonst wäre jemand grün, dessen
Abstract noch fehlt. Rechnung und Zahlung liegen zeitlich danach und sind deshalb
eigene Spalten. Die Rechnung hängt am Engagement, nicht am Beitrag: ein Speaker mit
zwei Vorträgen stellt eine Rechnung — und kann durchaus schon abgerechnet haben,
während seine Folien noch fehlen.

### Position in der Spalte

Die Karte hat zwei Koordinaten, und beide stehen im Engagement:

- `status` — die Spalte, der waagerechte Fortschritt.
- `position` — die Zeile, senkrecht von `0` bis `n`.

`position` zählt **innerhalb einer Spalte einer Konferenz**. Beim Umsortieren wird die
betroffene Spalte neu durchnummeriert; wandert eine Karte in eine andere Spalte, wird
die Quellspalte geschlossen und die Zielspalte an der Einfügestelle aufgerückt. Neue
Karten hängen sich hinten an, damit eine aufgebaute Ordnung nicht von oben zerdrückt
wird.

Es wird nichts abgeleitet und nichts automatisch umgestellt. Die Tafel steht so, wie
sie gestellt wurde.

Lesen bleibt trotzdem tolerant: Lücken oder doppelte Nummern — etwa nachdem von Hand
eine Notiz gelöscht wurde — sind kein Fehler. Sortiert wird nach `position`, bei
Gleichstand nach Name, und beim nächsten Umsortieren ist die Spalte wieder sauber
durchgezählt.

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

Alle drei leben in **einem einzigen Obsidian-View**, der über ein Ribbon-Icon geöffnet
wird und intern umschaltet. Sie teilen sich denselben Zustand — welche Konferenz gerade
dran ist —, man springt ständig zwischen ihnen, und Drag & Drop zwischen Pool und
Raster funktioniert ohnehin nur innerhalb eines Views. Drei eigene View-Typen wären
drei Obsidian-Tabs, die man einzeln aufräumen muss.

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

### Sichten sind Projektionen

Keine Sicht hält eigenen Zustand. Die Statustafel ist gerechnet aus den
Engagement-Notizen, die Agenda aus dem Raster der Konferenznotiz plus den
Beitragsnotizen. Es gibt keine Datenbank neben den Notizen.

| Auf der Karte | Kommt her |
|---|---|
| Spalte und Zeile | `status` und `position` im Engagement |
| „2 Beiträge" | die Beitragsnotizen, die auf diesen Speaker und diese Konferenz zeigen |
| „2.400 €" | das Feld `honorar` des Engagements — nicht gerechnet, sondern verhandelt |
| Fortschrittsbalken „4 von 8" | die Markdown-Tasks im Engagement und in seinen Beiträgen |
| „⏱ 8 Wochen ohne Antwort" | `angefragt_am` gegen heute |
| „1 Beitrag heimatlos" | ein Beitrag, dessen `block` es im Raster nicht mehr gibt |
| „1 im Pool" | ein Beitrag ohne `block` |
| „Saal Elbe · 150 Plätze" am Slot | der Track, überschrieben durch einen Eintrag in `slots` |
| „⚠ Workshop für 40, Raum für 30" | `max_teilnehmer` des Beitrags gegen die `kapazitaet` des Slots |

Nichts davon wird gespeichert — deshalb hat das Engagement keine Beitragsliste im
Frontmatter. Sie wäre eine zweite Wahrheit, die veraltet. Das `honorar` ist kein
Gegenbeispiel: Es ist nicht aus den Beiträgen gerechnet, sondern die vereinbarte Zahl
selbst, und steht damit auf derselben Stufe wie `status`.

Geschrieben wird entsprechend wenig: Karte in eine andere Spalte ziehen ändert
`status`, Umsortieren die `position`, ein Häkchen eine Zeile im Body.

Obsidians `metadataCache` liefert Frontmatter und Tasks fertig geparst und meldet
Änderungen. Das gilt auch in der Gegenrichtung: Wird in der Notiz von Hand ein Häkchen
gesetzt, wandert der Balken auf der Tafel sofort mit.

### Was auf einer Karte stehen darf

Nur, was sich aus Frontmatter und Tasks rechnen lässt — dazu höchstens ein wörtlicher
Auszug aus dem Body. **Nichts, was aus Fließtext gedeutet werden müsste.** „Honorar noch
strittig" oder „3 Plätze gesucht" stehen in den Demodaten nur als Prosa; solche Sätze
zeigt die Karte allenfalls als Zitat der ersten Notizzeile, nie als gerechnete Aussage.

Damit sind die UI-Entwürfe in `docs/ui/` an einigen Stellen weiter, als die Daten
tragen. Sie bleiben das Zielbild für Aufbau, Zustände und Farben, aber im Zweifel gilt,
was hier und im Vault steht. Ersatzlos entfallen vorerst:

- die Track-Buchstaben „Track A/B/C" in den Spaltenköpfen — es gibt nur `id` und `name`.
  Aus der Position abgeleitet wären sie gefährlich: fiele ein Track in der Mitte weg,
  würde aus „Track C" plötzlich „Track B" und alle Notizen zeigten ins Leere.
- „3 Plätze gesucht" am Panel — solange ein Beitrag nur einen Speaker kennt, gibt es
  keine Zahl dafür.
- die gedeuteten Zeilen auf den Statustafel-Karten („will 2.400 €, Budget 1.800 €",
  „fällig am 01.09.", „Slot 11:00 Track A ist frei").
- das Honorar auf den Karten im Agenda-Raster („2.800 €" an der Keynote). Es hängt am
  Engagement und gilt für alle Beiträge eines Speakers zusammen — an einem einzelnen
  Slot wäre jede Zahl erfunden. Es steht auf der Statustafel, wo der Mensch steht.

### Überblick im View, Details in der Notiz

Der View ist für Überblick und Bewegung — blättern, ziehen, Status ändern, abhaken.
Für Details wird nichts nachgebaut: Ein Klick auf eine Karte öffnet die Speaker- oder
Beitragsnotiz im Nachbar-Pane, und dort werden Abstract, Bio und Gesprächsnotizen im
normalen Editor geschrieben. Das spart die halbe Formular-Oberfläche und hält die
Notizen im Zentrum.

---

## 6. Regeln

- **Automatisches Engagement** — Wird im Slot ein Speaker zugewiesen, der noch kein
  Kandidat ist, entsteht sein Engagement automatisch im Status `gemerkt`.
- **Block verschieben** — Ändert nur das Zeit-Attribut des Blocks; alle Beiträge
  wandern mit, weil sie an der Block-ID hängen.
- **Track oder Block löschen** — Die betroffenen Beiträge werden nicht gelöscht,
  sondern **heimatlos** und landen sichtbar im Pool. Einträge in `slots`, die auf den
  gelöschten Track oder Block zeigen, verschwinden dagegen mit: Sie bezeichnen keinen
  Slot mehr, und im Gegensatz zu einem Beitrag steckt in ihnen keine Arbeit.
- **Streichen** — Alle Beiträge dieses Speakers in dieser Konferenz werden geleert, die
  Slots sind wieder Löcher, das Engagement wandert nach `gestrichen`. Welche Slots und
  Themen vorgesehen waren, bleibt als Spur im Engagement.
- **Umsortieren** — Eine Karte zu verschieben schreibt `position` in allen Engagements
  der betroffenen Spalten neu, in einem Durchgang.
- **Honorar** — Summe der Engagement-Honorare je Konferenz, gegen das `honorarbudget`.
  Gestrichene Engagements zählen nicht mit; ein Betrag, der nur angeboten und noch nicht
  zugesagt ist, dagegen schon — sonst wüsste man erst hinterher, ob es reicht.

### Was das Plugin prüft, ohne dass man fragt

Doppelbelegung eines Slots · derselbe Speaker in zwei parallelen Tracks · ein Beitrag,
dessen Format nicht in die Blockdauer passt · ein Beitrag, dessen `max_teilnehmer` über
der `kapazitaet` seines Slots liegt · offene Slots · heimatlose Beiträge · Beiträge,
deren Speaker noch nicht zugesagt hat.

---

## 7. Offene Punkte

- **Beiträge über mehrere Blöcke** — derzeit über lange Blöcke gelöst (`b5`, `b6`).
  Reicht das, oder braucht ein Beitrag eine Liste von Blöcken?
- **Wo Konferenz und Veranstalter entstehen** — Für den Speakerkatalog gibt es eine
  Sicht, für die Stammdaten nicht. Bei zwei bis drei Veranstaltern insgesamt und ein
  bis zwei Konferenzen je Veranstalter und Jahr lohnt kein eigener Reiter; er stünde
  die übrige Zeit im Weg. Vorschlag: ein Konferenz-Umschalter im Kopf des Views — den
  gemeinsamen Zustand „welche Konferenz ist dran" braucht es ohnehin — und darin
  „+ Neue Konferenz". Der Veranstalter entsteht dabei nebenbei mit seinem Namen, alles
  Weitere steht in seiner Notiz. Noch nicht entschieden.
- **Wer das Raster schreibt** — Von Hand ist verschachteltes YAML heikel: Ein falsches
  Leerzeichen zerlegt nicht ein Feld, sondern das ganze Frontmatter, und die
  Konferenznotiz verliert auf einen Schlag auch Veranstalter, Budget und Deadline.
  Drei Wege: (a) das Plugin schreibt das Raster und der Mensch fasst es nicht an — dann
  kann nichts verrutschen; (b) eine Markdown-Tabelle im Body, robuster und mit
  Tabelleneditor, aber ein zweites Format und Struktur außerhalb des Frontmatters;
  (c) Handarbeit im YAML, nur mit sehr flacher Syntax vertretbar. Empfehlung ist (a).
  Eilig ist es nicht: Die Statustafel liest vom Raster allein die Blöcke, um heimatlose
  Beiträge zu erkennen.
- **Raum wechselt über den Tag** — die Kaskade nimmt an, dass ein Track seinen Raum
  behält. Zieht ein Track mittags um, braucht es je betroffenem Slot einen Eintrag.
  Reicht das, oder gehören Raum und Kapazität doch an den Block?
- **Reisekosten** — eigenes Feld am Engagement oder Teil des Honorars?
- **Wiederverwendung** — soll beim Füllen eines Slots vorgeschlagen werden, welche
  Beiträge ein Speaker in früheren Jahren gehalten hat?
- **Bedarfsplanung** — lohnt ein Soll je Format („2 Keynotes, 12 Vorträge"), oder
  ergibt sich der Bedarf ohnehin schon vollständig aus dem Raster?
- **Feldnamen** — bleiben deutsch wie hier, oder englisch im Frontmatter?
```
