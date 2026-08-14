# SMS – Speaker Management System

Obsidian-Plugin für Content Manager von Konferenzen: Speaker über Jahre
katalogisieren, je Konferenz durch einen Akquise-Funnel führen, ihre Beiträge in die
Tagesagenden einplanen.

**[docs/Konzept.md](docs/Konzept.md) ist die verbindliche Quelle** für Domänenmodell,
Dateiformate, Statusmodell, Sichten und Regeln. Vor Änderungen am Datenmodell oder an
den Sichten dort nachlesen — und bei neuen Entscheidungen dort nachziehen, sonst
verläuft sich das Wissen im Chat.

Die UI-Entwürfe in `docs/ui/` (SVG und PNG) zeigen das Zielbild für Agenda-Raster und
Statustafel. Sie sind Entwürfe, keine Spezifikation bis auf den Pixel, aber die
Zustände und ihre Farben sind so gemeint.

**Im Zweifel gilt der Vault, nicht der Entwurf.** Die Entwürfe zeigen an einigen Stellen
Angaben, die nur als Fließtext in den Notizen stehen und sich nicht rechnen lassen. Was
nicht strukturiert im Frontmatter oder in einer Checkliste steht, wird auch nicht
angezeigt — die entfallenen Stellen sind im Konzept unter „Was auf einer Karte stehen
darf" aufgezählt.

Der Test-Vault ist mit einem vollständigen Datensatz gefüllt, der **genau diese
Entwürfe abbildet** — siehe `Speaker Management System Test Vault/Demodaten.md`. Er enthält absichtlich jeden
Sonderfall: titelloser Beitrag, heimatloser Beitrag, Pool, plenarer Block, Speaker mit
mehreren Beiträgen, Checklisten in jedem Reifegrad, ein zweiter Tag mit anderem Raster.
Beim Bauen einer Sicht ist er Testdatensatz und Sollbild zugleich; die Kennzahlen dort
(18.400 €, 21 Slots, 15 belegt) müssen herauskommen.

## Aufbau

```
plugin/                                 das Obsidian-Plugin (TypeScript, esbuild)
Speaker Management System Test Vault/   Vault zum Entwickeln; plugin/ hängt
                                        per Symlink unter .obsidian/plugins/
docs/                                   Konzept und UI-Entwürfe
```

## Entwickeln

```bash
cd plugin && npm install && npm run dev
```

`npm run dev` baut bei jeder Änderung neu, `npm run build` erzeugt den
Produktionsbuild und prüft vorher die Typen. `npm test` prüft die Fachlogik —
esbuild bündelt die Tests nach `tests/build/`, `node --test` führt sie aus; kein
Test-Framework als Abhängigkeit. `plugin/main.js` ist Build-Ergebnis und
nicht im Git — nach einem frischen Clone zeigt der Symlink also auf einen Ordner ohne
`main.js`, und Obsidian meldet einen Ladefehler, bis einmal gebaut wurde.

Den Vault öffnet man in Obsidian über *Open folder as vault* mit `Speaker Management System Test Vault`. Das
Plugin muss man dort **einmal je Rechner** unter *Einstellungen → Community-Plugins*
einschalten; der Aktivierungszustand ist bewusst nicht im Git, weil Obsidian ihn beim
Start ausschaltet, solange noch nicht gebaut wurde. Nach einem Build lädt man das Plugin
mit Cmd+R neu.

Auf einem zweiten Rechner gilt nach jedem Pull dieselbe Reihenfolge: `npm run build`
(und `npm install`, wenn sich `package-lock.json` geändert hat), dann Cmd+R.

Die Version im Kopf des Views kommt aus `package.json` und wird beim Bauen ins Bundle
eingesetzt — nicht aus `plugin.manifest`, den Obsidian beim Start liest und danach
festhält. Sie ändert sich damit genau dann, wenn sich `main.js` ändert, und verrät
zuverlässig, ob der eigene Build der neue ist. **Bei jeder Änderung die Version in
`package.json` und `manifest.json` gemeinsam hochziehen** — `manifest.json` ist das,
was Obsidian in seiner Plugin-Liste zeigt.

Entwickelt wird nur auf macOS — der eingecheckte Symlink ist relativ und funktioniert
auf jedem Mac, auf Windows aber nicht ohne `core.symlinks=true`.

## Veröffentlichen

Ein Release entsteht durch einen Tag mit der blanken Version, ohne `v` davor:

```bash
git tag 0.10.0 && git push origin 0.10.0
```

`.github/workflows/release.yml` baut daraufhin, lässt die Tests laufen und hängt
`main.js`, `manifest.json` und `styles.css` an ein GitHub-Release. Der Workflow bricht
ab, wenn der Tag nicht genau der Version in `manifest.json` und `package.json`
entspricht — Obsidian und BRAT finden ein Release sonst nicht.

In anderen Vaults installiert man das Plugin über BRAT mit
`ralfw-vibe-coding/Speaker-Management-System`.

## Tests

Geprüft wird die **Fachlogik**, nicht die Oberfläche: `felder.ts`, `namen.ts`,
`projektion.ts` und die Rasterfunktionen aus `modell.ts`. Die kommen ohne Obsidian aus,
deshalb braucht es keinen Vault und keine Attrappen — genau dafür sind sie aus den
Sichten herausgelöst.

Die Zahlen in den Tests sind die aus `Demodaten.md`. Wer dort etwas ändert, ändert sie
hier mit; wer eine Regel ändert, sieht hier, was daran hing.

Neue Fachlogik gehört in diese Module und nicht in eine Sicht — sonst ist sie nicht
prüfbar.

## Verbindliche Entscheidungen

Diese Punkte sind entschieden, nicht offen. Begründungen stehen im Konzept.

- **Es heißt Konferenz, nicht Veranstaltung.** Endgültig. „Veranstaltung" schlösse ein
  Seminar ein; hier geht es um viele Slots und viele Speaker. Nur der **Veranstalter**
  behält seinen Namen — er ist der Auftraggeber, nicht das Ereignis.
- **Die Notizen sind die Wahrheit.** Kein eigener Datenspeicher neben dem Vault.
  Strukturierte Felder im YAML-Frontmatter, Freitext im Body, Beziehungen als
  Wikilinks.
- **Sichten sind Projektionen.** Statustafel und Agenda halten keinen eigenen Zustand;
  alles auf den Karten ist gerechnet. Nichts Abgeleitetes wird zusätzlich gespeichert.
- **Ein einziger View** mit interner Umschaltung zwischen Konferenzübersicht,
  Speakerkatalog, Statustafel und Agenda — kein eigener View-Typ je Sicht.
- **Details in der Notiz, nicht im Formular.** Ein Klick auf eine Karte öffnet die
  Notiz im Nachbar-Pane.
- **Das Plugin besitzt die Dateien.** Notizen entstehen durch den View, nicht von Hand;
  damit sind Namen eindeutig und Frontmatter korrekt.
- **Eng schreiben, tolerant lesen.** Beim Schreiben nur die eigenen Felder anfassen,
  Body und Fremdfelder unangetastet lassen. Beim Lesen ein fehlendes Feld verkraften.
- **Dateinamen müssen vault-weit eindeutig sein**, weil Obsidian Wikilinks über den
  Dateinamen auflöst. Engagements und Beiträge tragen deshalb den Konferenznamen als
  Präfix.
- **Slot-Identität ist `(Block-ID, Track-ID)`.** Die Uhrzeit ist ein Attribut des
  Blocks. Ein Block lässt sich verschieben, ohne dass Beiträge ausfallen.
- **Ein Beitrag darf über mehrere Blöcke laufen.** `block` verträgt eine Liste, wie
  `speaker`: Der Normalfall bleibt ein einzelner Wert, gelesen wird beides.
- **Raum und Kapazität kaskadieren** vom Track über die Blockzeile zum einzelnen Slot;
  die Liste `slots` in der Konferenznotiz trägt nur die Ausnahmen.
- **Das Honorar hängt am Engagement, nicht am Beitrag.** Verhandelt wird mit dem
  Menschen über das Paket; eine Aufteilung auf einzelne Beiträge wäre erfunden.
- **Ein Beitrag, ein Speaker.** Das Feld ist eine Liste und wird tolerant gelesen, aber
  das Plugin schreibt nur einen. Weitere Beteiligte stehen als Prosa im Body.
- **Nichts sortiert sich von selbst.** Die Reihenfolge auf der Statustafel steht als
  `position` im Engagement und ändert sich nur, wenn jemand sie ändert.
- **Die `wahl` gilt je Thema, die `bewertung` je Engagement.** Erste Wahl ist man für
  ein Thema, nicht als Person; bewertet wird ein Auftritt, nicht ein Mensch. Im Katalog
  erscheint die Bewertung als Historie — gerechnet, nicht gespeichert.
- **Kein Import.** Speaker kommen von Hand in den Katalog oder beim Füllen eines Slots.
  Es gibt keinen Call for Papers und keine Agenturlisten.

## Konventionen

- **Domänenvokabular ist deutsch** und stammt vom Auftraggeber: Konferenz, Tag, Block,
  Track, Slot, Beitrag, Speaker, Engagement, Veranstalter. `track`, `block` und `slot`
  funktionieren in beiden Sprachen und bleiben so auch im Code.
- Frontmatter-Felder, Bezeichner, Kommentare, UI-Texte und Commit-Nachrichten sind
  deutsch.
- Tabs zur Einrückung im Plugin-Code (Obsidian-Konvention).

## Stand der Umsetzung

Datenschicht, Speakerkatalog und Statustafel stehen, lesend:

- `src/main.ts` — Plugin, Ribbon-Icon, Kommando, Öffnen des Views
- `src/settings.ts` — die drei Datenordner konfigurierbar
- `src/daten/modell.ts` — die Typen, die Formatwerte, die Reihenfolge des Funnels
- `src/daten/felder.ts` — das tolerante Lesen einzelner Frontmatter-Felder
- `src/daten/namen.ts` — Dateinamen und Terminspannen
- `src/daten/projektion.ts` — die Fachlogik der Sichten: Reifegrad, heimatlos, Dauer,
  Überschneidungen, Doppelbelegung, Zielblöcke
- `src/daten/lesen.ts` — `Datenzugriff`: Notizen über den `metadataCache` finden und
  tolerant lesen, samt Checklisten. Die `slots`-Ausnahmen der Konferenz werden noch
  nicht gelesen; sie kommen mit der Agenda.
- `src/daten/schreiben.ts` — `Datenschreiber`: legt Notizen an, prüft Namen
- `src/view/konferenzen.ts` — die Übersicht: bevorstehende Konferenzen und Archiv
- `src/view/katalog.ts` — der Speakerkatalog mit Suche, Filtern und Historie
- `src/view/SpeakerAnlegenModal.ts` — fragt nur nach dem Namen
- `src/view/statustafel.ts` — die acht Spalten des Funnels mit ihren Karten
- `src/view/agenda.ts` — das Raster je Tag, der Pool, die Kandidaten ohne Beitrag
- `src/view/SmsView.ts` — der View mit drei Reitern und der Konferenzauswahl

Geschrieben wird zweierlei: „+ Speaker" im Katalog legt eine Notiz an, und das Ziehen
einer Karte auf der Statustafel schreibt `status` und `position` — über
`processFrontMatter`, das Body und Fremdfelder unangetastet lässt.

In der Agenda lassen sich Beiträge zwischen Pool und Raster ziehen; das schreibt `block`
und `track`. Ist das Ziel belegt, **tauschen** die beiden ihre Plätze, statt einen Slot
doppelt zu belegen. Zieht man einen **Kandidaten** in einen freien Slot, entsteht seine
Beitragsnotiz — titellos und vorläufig nach ihrem Platz benannt. Zieht man ihn auf ein
Thema ohne Speaker, wird er dort eingetragen; damit funktionieren beide Richtungen des
Füllens.

Umbenannt wird, wo das Plugin die Ursache ist: beim Anlegen und beim Verschieben eines
titellosen Beitrags. Steht ein Titel da, bietet die Karte es an — ein Automatismus auf
`titel` würde beim Tippen bei jedem Buchstaben umbenennen. Angefasst wird nur, was noch
den Platzhalternamen trägt.

Im Katalog macht „merken" aus einem Speaker einen Kandidaten der ausgewählten Konferenz:
ein Engagement im Status `gemerkt`, hinten an die Spalte gehängt. Ein Klick auf einen
Themen-Chip schaltet die `wahl` zu diesem Thema weiter.

Bei Konferenzen im Status `gelaufen` oder `abgesagt` ist die **Agenda gesperrt** — das
Programm ist Archiv. Die **Statustafel bleibt bedienbar**, weil Rechnungen, Zahlungen
und die Bewertung erst nach der Konferenz kommen. Den Status setzt man auf der Karte in
der Übersicht; das ist auch der Weg, ein Archiv für eine Berichtigung wieder zu öffnen.

Eine Karte nach `gestrichen` zu ziehen löst die **Streichen-Regel** aus, hinter einer
Rückfrage: Themen mit Titel landen ohne Speaker im Pool, titellose Beiträge im
Papierkorb, und was vorgesehen war, wird ins Engagement geschrieben.

Über den Knopf neben der Konferenzauswahl entstehen **Konferenz und Veranstalter**. Die
neue Konferenz bekommt ein Anfangsraster: ein Tag, ein Track, drei Blöcke.

Das **Raster** wird in der Agenda gebaut: Tage, Tracks und Blöcke anlegen, ändern,
löschen. Beim Löschen verlieren die betroffenen Beiträge ihren Platz und landen im
Pool — hinter einer Rückfrage, die sie zählt. Blockzeiten werden einzeln gepflegt; ein
Block verschiebt die folgenden nicht.

Die Block-ID bleibt beim Ändern erhalten, denn an ihr hängen die Beiträge. Verschoben
wird nur die Zeit. Eine Karte nach `gestrichen` zu ziehen bewegt bisher nur die Karte;
die Beiträge des Speakers werden **nicht** geleert.

### Reihenfolge

Verabredet ist, in dieser Reihenfolge zu bauen — nicht mit der Agenda anfangen:

1. ~~**Datenschicht und Speakerkatalog, lesend.**~~ Steht seit v0.0.4. Liste aller
   Speaker mit Themen, Formaten, Sprachen, Wahl und Historie, dazu Suche und Filter.
   Prüfbar gegen die Kennzahlen für den Katalog in `Demodaten.md`.
2. ~~**Statustafel, lesend.**~~ Steht seit v0.0.5. Kopf mit den Kennzahlen, die acht
   Spalten, Karten mit Themen, Beitragszahl, Honorar, Checklistenbalken und Hinweisen.
3. ~~**Statustafel, schreibend.**~~ Steht seit v0.0.7. Karten zwischen den Spalten
   ziehen und umsortieren; das schreibt `status` und `position`. Offen bleibt die
   Streichen-Regel.
4. ~~**Agenda.**~~ Lesend seit v0.0.8, ziehend seit v0.0.9: Raster je Tag, Slots mit
   ihrem Reifegrad, Pool, heimatlose Beiträge, Kandidaten ohne Beitrag, Raum- und
   Kapazitätskaskade, Beiträge zwischen Pool und Raster verschiebbar.

Der Katalog zuerst, weil er die kleinste Sicht mit der größten gemeinsamen Grundlage
ist: ein Notiztyp, flaches Frontmatter, keine Summen. Was dabei entsteht — Notizen über
den `metadataCache` finden, tolerant lesen, auf Änderungen reagieren, Klick öffnet die
Notiz im Nachbar-Pane — trägt anschließend die Statustafel.

Die Statustafel spielt danach die ganze Projektionslogik durch: Checklisten aus dem Body
zählen, Beiträge über Wikilinks den Speakern zuordnen, Summen gegen das Budget. Vom
Raster braucht sie allein die Blöcke, um heimatlose Beiträge zu erkennen. Danach ist die
Agenda vor allem noch Darstellung und Drag & Drop.

Die Aktion „als Kandidat für ⟨Konferenz⟩ merken" gehört **nicht** in den ersten Schritt:
Sie schreibt ein Engagement und setzt eine ausgewählte Konferenz voraus.

Am Ende von [docs/Konzept.md](docs/Konzept.md) steht eine Liste offener Punkte
(Beiträge über mehrere Blöcke, Reisekosten, Bedarfsplanung, wo Konferenz und
Veranstalter entstehen, wer das Raster schreibt, und anderes). Die sind bewusst noch
nicht entschieden — nicht einfach etwas annehmen, sondern nachfragen.
