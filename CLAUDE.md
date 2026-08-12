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
Produktionsbuild und prüft vorher die Typen. `plugin/main.js` ist Build-Ergebnis und
nicht im Git — nach einem frischen Clone zeigt der Symlink also auf einen Ordner ohne
`main.js`, und Obsidian meldet einen Ladefehler, bis einmal gebaut wurde.

Den Vault öffnet man in Obsidian über *Open folder as vault* mit `Speaker Management System Test Vault`. Das
Plugin muss man dort **einmal je Rechner** unter *Einstellungen → Community-Plugins*
einschalten; der Aktivierungszustand ist bewusst nicht im Git, weil Obsidian ihn beim
Start ausschaltet, solange noch nicht gebaut wurde. Nach einem Build lädt man das Plugin
mit Cmd+R neu.

Auf einem zweiten Rechner gilt nach jedem Pull dieselbe Reihenfolge: `npm run build`
(und `npm install`, wenn sich `package-lock.json` geändert hat), dann Cmd+R.

Entwickelt wird nur auf macOS — der eingecheckte Symlink ist relativ und funktioniert
auf jedem Mac, auf Windows aber nicht ohne `core.symlinks=true`.

## Verbindliche Entscheidungen

Diese Punkte sind entschieden, nicht offen. Begründungen stehen im Konzept.

- **Die Notizen sind die Wahrheit.** Kein eigener Datenspeicher neben dem Vault.
  Strukturierte Felder im YAML-Frontmatter, Freitext im Body, Beziehungen als
  Wikilinks.
- **Sichten sind Projektionen.** Statustafel und Agenda halten keinen eigenen Zustand;
  alles auf den Karten ist gerechnet. Nichts Abgeleitetes wird zusätzlich gespeichert.
- **Ein einziger View** mit interner Umschaltung zwischen Speakerkatalog, Statustafel
  und Agenda — kein eigener View-Typ je Sicht.
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
- **Raum und Kapazität kaskadieren** vom Track über die Blockzeile zum einzelnen Slot;
  die Liste `slots` in der Konferenznotiz trägt nur die Ausnahmen.
- **Das Honorar hängt am Engagement, nicht am Beitrag.** Verhandelt wird mit dem
  Menschen über das Paket; eine Aufteilung auf einzelne Beiträge wäre erfunden.
- **Ein Beitrag, ein Speaker.** Das Feld ist eine Liste und wird tolerant gelesen, aber
  das Plugin schreibt nur einen. Weitere Beteiligte stehen als Prosa im Body.
- **Nichts sortiert sich von selbst.** Die Reihenfolge auf der Statustafel steht als
  `position` im Engagement und ändert sich nur, wenn jemand sie ändert.

## Konventionen

- **Domänenvokabular ist deutsch** und stammt vom Auftraggeber: Konferenz, Tag, Block,
  Track, Slot, Beitrag, Speaker, Engagement, Veranstalter. `track`, `block` und `slot`
  funktionieren in beiden Sprachen und bleiben so auch im Code.
- Frontmatter-Felder, Bezeichner, Kommentare, UI-Texte und Commit-Nachrichten sind
  deutsch.
- Tabs zur Einrückung im Plugin-Code (Obsidian-Konvention).

## Stand der Umsetzung

Es steht bisher nur das Gerüst:

- `src/main.ts` — Plugin, Ribbon-Icon, Kommando, Öffnen des Views
- `src/settings.ts` — die drei Datenordner konfigurierbar
- `src/view/SmsView.ts` — der View mit drei Reitern, **Inhalte sind Platzhalter**

Es gibt noch kein Lesen und kein Schreiben von Notizen, keine Datenschicht, keine der
drei Sichten. Alles Fachliche ist offen.

### Reihenfolge

Verabredet ist, in dieser Reihenfolge zu bauen — nicht mit der Agenda anfangen:

1. **Datenschicht und Statustafel, lesend.** Kopf mit den Kennzahlen, die acht Spalten,
   Karten mit Themen, Beitragszahl, Honorar, Checklistenbalken und Hinweisen. Prüfbar
   gegen die Kennzahlen in `Demodaten.md`.
2. **Statustafel, schreibend.** Karten zwischen den Spalten ziehen und umsortieren; das
   schreibt `status` und `position`.
3. **Agenda.**

Die Statustafel zuerst, weil dort die tägliche Arbeit liegt und weil sie die ganze
Projektionslogik einmal durchspielt: Frontmatter lesen, Checklisten aus dem Body
zählen, Beiträge über Wikilinks den Speakern zuordnen, Summen gegen das Budget. Vom
Raster braucht sie allein die Blöcke, um heimatlose Beiträge zu erkennen. Danach ist die
Agenda vor allem noch Darstellung und Drag & Drop.

Am Ende von [docs/Konzept.md](docs/Konzept.md) steht eine Liste offener Punkte
(Beiträge über mehrere Blöcke, Reisekosten, Bedarfsplanung, wo Konferenz und
Veranstalter entstehen, wer das Raster schreibt, und anderes). Die sind bewusst noch
nicht entschieden — nicht einfach etwas annehmen, sondern nachfragen.
