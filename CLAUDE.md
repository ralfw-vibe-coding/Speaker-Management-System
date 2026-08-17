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
(22.400 €, 21 Slots, 18 belegt) müssen herauskommen.

Um Aussagen über einen Vault unabhängig von der Plugin-Fachlogik gegenzuprüfen (z.B.
Frontmatter-Felder, Backlinks, Checklisten-Status), eignet sich die native
Obsidian-CLI (`obsidian --help`) — Details und Beispiele stehen im Skill
`obsidian-cli`, dessen Quelle unter
[plugin/src/vaultdoku/obsidian-cli.md](plugin/src/vaultdoku/obsidian-cli.md) liegt.
Voraussetzung: Obsidian läuft und hat den jeweiligen Vault offen.

## Was das Plugin in den Vault schreibt

Eine Claude-Session läuft (über Claudian) **im Vault**, nicht in diesem Repo — sie sieht
also nur, was im Vault liegt. Damit auch ein frisch über BRAT bestückter, sonst leerer
Vault sofort Bescheid weiß, liefert das Plugin drei Dateien mit:

```
CLAUDE.md                                  Zweck des Vaults, die fünf Notiztypen, vier harte Regeln
.claude/skills/sms-datenmodell/SKILL.md    vollständige Feldreferenz samt Raster-Kodierung
.claude/skills/obsidian-cli/SKILL.md       Obsidians eingebaute Kommandozeile
```

Die Quellen liegen unter [plugin/src/vaultdoku/](plugin/src/vaultdoku/) und werden beim
Bauen als Text ins Bundle eingesetzt (`loader: { ".md": "text" }`). Geschrieben wird
beim ersten Start nach einer neuen Version und über den Befehl *Claude-Dokumentation in
diesen Vault schreiben*.

Die beiden Skills gehören dem Plugin und werden überschrieben. **`CLAUDE.md` gehört dem
Nutzer** und wird nur angelegt, wenn es keine gibt — nur der Befehl von Hand überschreibt
sie.

Im Test-Vault liegen die drei Dateien mit im Git, damit er nach einem Clone vollständig
ist, bevor das Plugin je gelaufen ist. Sie sind dort Kopien, keine Quelle: Wer den Text
ändert, ändert ihn unter `plugin/src/vaultdoku/`, baut, und lässt den Befehl laufen.

**Diese Doku beschreibt Datenstrukturen — sie muss stimmen.** Ändert sich ein
Frontmatter-Feld, ein Statuswert oder die Kodierung des Rasters, gehört
`sms-datenmodell.md` im selben Commit nachgezogen.

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
zuverlässig, ob der eigene Build der neue ist.

**Die Version wird an drei Stellen hochgezogen, und zwar so:**

```bash
cd plugin && npm version 0.18.0 --no-git-tag-version
```

Das ändert `package.json` **und** `package-lock.json`; `manifest.json` zieht man
danach von Hand nach. Wer nur die beiden JSON-Dateien anfasst und die Sperrdatei
vergisst, bricht den Release-Workflow: Er beginnt mit `npm ci`, und das verweigert den
Dienst, sobald `package.json` und `package-lock.json` verschiedene Versionen nennen.
Der Tag liegt dann sauber auf GitHub, aber es entsteht nie ein Release — von 0.11.0
bis 0.17.0 ist genau das passiert.

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

## Wenn ein Feld dazukommt

Ein neues Feld wird in `schema.ts` eingetragen — dort und nicht anderswo. Daraus folgt
das Gerüst neuer Notizen, das Ergänzen alter, und der Test, der die ausgelieferte Doku
dagegenhält. Zu tun bleibt: der Typ in `modell.ts`, das Lesen in `lesen.ts`, die
Bedeutung in `sms-datenmodell.md`.

**Das Nachtragen schreibt als Texteinschub**, nicht über `processFrontMatter`. Die API
gibt das Frontmatter geparst zurück und schreibt anschließend den ganzen Block neu, in
Obsidians eigenem YAML-Stil — aus `themen: [a, b]` würde eine mehrzeilige Liste. Beim
Ändern eines Wertes nehmen wir das in Kauf, weil YAML von Hand zu erzeugen die fragilere
Wahl wäre. Beim Nachtragen wird aber nur angefügt, nie geändert, und dafür genügt eine
eingeschobene Zeile.

**Bestehende Notizen kennen das Feld nicht.** Das ist kein Fehler — gelesen wird
tolerant —, aber Obsidian zeigt eine Eigenschaft nicht an, die in der Datei fehlt.
Deshalb weist die Konferenzübersicht darauf hin und bietet „Felder ergänzen" an; denselben
Vorgang gibt es als Befehl. **Das Plugin schreibt von sich aus nie**, auch nicht nach
einem Update.

**Zwei Regeln, die daran hängen:**

- **Ein fehlender Wert wird nur dann als 0 gerechnet, wenn null die richtige Aussage
  ist** — sonst wird er als „unbekannt" ausgewiesen. Jedes Zahlenfeld sagt das in
  `schema.ts`; ein Test besteht darauf.
- **Die Bedeutung eines Feldes wird nie geändert.** Ändert sie sich, bekommt es einen
  neuen Namen. Eine Umbenennung ist erkennbar, eine verschobene Bedeutung nicht — alte
  Dateien parsen sauber und rechnen falsch.

Umformende Schritte (umbenennen, zusammenlegen) gibt es noch nicht. Sie gehören in
`migration.ts` und wären alles oder nichts; dafür steht `SCHEMA_VERSION` bereit, und der
Vault merkt sich seinen Stand in der `data.json` des Plugins.

## Beim Veröffentlichen

Ein Release, das am Schema rührt, muss es **an erster Stelle** in der
Release-Beschreibung nennen — nicht in Zeile zwölf zwischen zwei Fehlerbehebungen. Dazu
gehören drei Angaben: ob die Änderung **additiv** ist (neue Felder) oder **umformend**
(Werte wandern), was **zu tun** ist, und was passiert, **wenn man nichts tut**. Bei
additiven Änderungen ist die Antwort: nichts, außer dass neue Felder in alten Notizen
nicht auftauchen, bis man sie ergänzt.

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
- **Ein einziger View** mit interner Umschaltung zwischen Speakerkatalog,
  Konferenzübersicht, Agenda, Statustafel und Konzeption — kein eigener View-Typ je Sicht.
- **Ein Strang ist kein Track.** Die Konzeption ist die Phase, in der die Konferenz noch
  eine Idee ist; ihre Spalten sind Themenlinien, die entstehen und wieder vergehen
  dürfen, ohne dass am Raster etwas passiert. Deshalb ein eigenes Feld `strang` statt
  `track`. Aus Strängen werden Tracks nur beim „Raster daraus bauen" — und der Strang
  bleibt danach stehen, damit der Entwurf nachlesbar ist.
- **Eine Idee ist ein Beitrag ohne Block.** Kein eigener Notiztyp: Was in der Konzeption
  geschoben wird, sind dieselben Notizen, die später im Raster stehen. Der Übergang ist
  deshalb ein Platzieren, kein Umwandeln.
- **Verworfen ist nicht gelöscht.** `verworfen_am` nimmt eine Idee aus Pool, Raster und
  Statustafel, lässt sie aber im Vault und in ihrem Strang liegen — beim Planen des
  nächsten Jahres schaut man dort hinein.
- **Details in der Notiz, nicht im Formular.** Ein Klick auf eine Karte öffnet die
  Notiz im Nachbar-Pane. Ausgenommen sind einzelne Zahlen, die man im Gespräch
  oder im Rückblick nachträgt: Honorar, Reisekosten und Bewertung auf der
  Statustafel-Karte, die Teilnehmerbegrenzung auf der Slot-Karte. Die Regel richtet sich
  gegen Eingabemasken, nicht gegen ein Feld.
- **Eigene Notizen sind erlaubt.** Im Konferenzordner darf ohne `type` liegen, was der
  Nutzer selbst ablegt — Gesprächsnotizen, Angebote, Skizzen. Beanstandet wird ein
  fehlendes `type` nur dort, wo das Plugin selbst ablegt: in `engagements/`, `beiträge/`
  und für die Konferenznotiz. `type: notiz` nimmt eine Notiz überall ausdrücklich aus.
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
- **Die durchgehende Moderation ist eine Rolle am Engagement, kein Beitrag.** Sie führt
  über alle Blöcke und belegt keinen Slot; als Beitrag eingetragen wäre jeder
  Vortragsslot doppelt belegt. Sie zählt trotzdem gegen das Honorarbudget, weil das
  Honorar ohnehin am Engagement hängt. Wer moderiert *und* vorträgt, hat beides an einem
  Engagement. Die Eröffnung dagegen bleibt ein Beitrag mit `format: moderation` in einem
  plenaren Block.
- **Die Abendveranstaltung ist ein plenarer Block**, kein Fixblock — sonst wäre sie nicht
  besetzbar. Die Künstler sind Speaker mit `format: rahmenprogramm`.
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
- `src/daten/schema.ts` — **die eine Feldliste** je Notiztyp: Name, Art, Bedeutung,
  frühere Namen und wie ein fehlender Wert zu rechnen ist. Daraus entstehen das Gerüst
  beim Anlegen und das Ergänzen; ein Test hält die ausgelieferte Doku dagegen.
- `src/daten/migration.ts` — findet Notizen, denen neuere Felder fehlen, und trägt sie
  leer nach
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
- `src/view/konzeption.ts` — die Pinnwand der Ideenphase: Stränge, verworfene Ideen,
  die Rechnung „welches Raster folgt daraus" und der Übergang dorthin
- `src/view/SmsView.ts` — der View mit fünf Reitern und der Konferenzauswahl

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
