---
name: obsidian-cli
description: Nutzt die native Obsidian-CLI (Befehl `obsidian`, Teil der Obsidian.app selbst) statt Datei-Tools, wenn Vault-Operationen sauberer über Obsidians eigene API laufen sollen - z.B. Properties/Tags/Tasks/Links/Backlinks auswerten, Bookmarks, Plugins, Themes, Templates, Sync-Historie, Bases abfragen, oder Obsidian-Befehle/Hotkeys ausführen. Verwenden, wenn der Nutzer nach "Obsidian CLI" fragt, oder wenn eine Aufgabe von Obsidians eingebauter Such-/Metadaten-Logik profitiert (z.B. Backlinks, unresolved links, Tag-Zählung, Task-Status) statt das mit grep/Read nachzubauen.
---

# Obsidian CLI

Obsidian besitzt eine eingebaute CLI. Der Befehl `obsidian` ist der Electron-App-Binary
selbst im CLI-Modus (kein separates leichtgewichtiges Tool). Läuft headless und gibt
Text/JSON/TSV/CSV zurück.

Die CLI liest live aus der laufenden Obsidian-App (inkl. `metadataCache`), nicht aus dem
Dateisystem — Obsidian muss also mit dem betreffenden Vault offen sein. Für reine
Dateiinhalte ohne Obsidian-Semantik sind Read/Bash oft schneller.

## Welcher Vault

Ist der Vault in Obsidian geöffnet, wirken die meisten Befehle ohne `vault=` bereits auf
ihn. Bei mehreren offenen Vaults oder zur Sicherheit explizit angeben:

```bash
obsidian 'vault=<Vaultname>' vault
```

## Grundlagen & Gotchas

- **Aufruf:** `obsidian <command> [options]`
- **Langsam:** Jeder Aufruf lädt das App-Package neu (~1-2s Overhead) und gibt Warnzeilen
  aus wie `Loading updated app package ...` und `Your Obsidian installer is out of
  date ...`. Das sind normale stdout-Zeilen, keine Fehler — ggf. mit `tail -n +N` oder
  Filter ignorieren.
- **Quoting:** Werte mit Leerzeichen brauchen Anführungszeichen um den *ganzen*
  `key=value`-Ausdruck, z.B. `'vault=Mein Vault'` oder `'name=My Note'`. **Nicht**
  `vault=\"...\"` verwenden — das escaped falsch und führt zu `Vault not found.`
- **Mehrere Vaults:** `obsidian vaults` listet alle bekannten Vaults.
- **file vs. path:** `file=<name>` löst wie ein Wikilink auf (Name, unscharf), `path=<pfad>`
  ist exakt (`ordner/notiz.md`). Ohne beides wird meist die aktive Datei verwendet.
- **Newline/Tab in content:** `\n` und `\t` in `content=` werden interpretiert.
- **Aktuelle Referenz live abrufen:** `obsidian help` bzw. `obsidian help <command>` —
  falls sich die CLI mit neueren Obsidian-Versionen ändert, das dieser Referenz vorziehen.

## Befehlsübersicht

### Vault- & Datei-Basics
- `vaults` — bekannte Vaults auflisten (`total`, `verbose` für Pfade)
- `vault` — Vault-Info (`info=name|path|files|folders|size`)
- `files` — Dateien auflisten (`folder=`, `ext=`, `total`)
- `folders` — Ordner auflisten (`folder=`, `total`)
- `folder path=<pfad>` — Ordner-Info (`info=files|folders|size`)
- `file` — Datei-Info (`file=`/`path=`)
- `read` — Dateiinhalt lesen (`file=`/`path=`)
- `create` — neue Datei (`name=`, `path=`, `content=`, `template=`, `overwrite`, `open`, `newtab`)
- `append` / `prepend` — Inhalt anhängen/voranstellen (`content=` required, `inline` für ohne Newline)
- `move` — verschieben/umbenennen (`to=` required)
- `rename` — umbenennen (`name=` required, gleicher Ordner)
- `delete` — löschen (`permanent` für ohne Papierkorb)
- `open` — Datei öffnen (`newtab`)
- `random` / `random:read` — Zufallsnotiz öffnen/lesen (`folder=`)
- `recents` — zuletzt geöffnete Dateien (`total`)
- `wordcount` — Wörter/Zeichen zählen (`words`, `characters`)
- `outline` — Überschriften einer Datei (`format=tree|md|json`, `total`)

### Suche
- `search query=<text>` — Volltext (`path=`, `limit=`, `case`, `total`, `format=text|json`)
- `search:context query=<text>` — mit Zeilenkontext
- `search:open query=<text>` — Suchansicht öffnen

### Links & Struktur
- `links` — ausgehende Links einer Datei (`total`)
- `backlinks` — Backlinks zu einer Datei (`counts`, `total`, `format=json|tsv|csv`)
- `unresolved` — unaufgelöste Links im Vault (`counts`, `verbose`, `format=`)
- `orphans` — Dateien ohne eingehende Links (`total`, `all`)
- `deadends` — Dateien ohne ausgehende Links (`total`, `all`)
- `aliases` — Aliase im Vault (`file=`/`path=`, `active`, `total`, `verbose`)

### Properties & Tags
- `properties` — Properties im Vault (`file=`/`path=`/`active`, `name=`, `total`, `sort=count`, `counts`, `format=yaml|json|tsv`)
- `property:read name=<name>` — Wert lesen
- `property:set name=<name> value=<val>` — setzen (`type=text|list|number|checkbox|date|datetime`)
- `property:remove name=<name>` — entfernen
- `tags` — Tags im Vault (`file=`/`path=`/`active`, `counts`, `sort=count`, `total`, `format=`)
- `tag name=<tag>` — Info zu einem Tag (`total`, `verbose`)

### Tasks
- `tasks` — Tasks im Vault (`file=`/`path=`/`active`/`daily`, `done`, `todo`, `status=`, `verbose`, `total`, `format=json|tsv|csv`)
- `task` — einzelnen Task anzeigen/ändern (`ref=<pfad:zeile>` oder `file=`+`line=`, `toggle`, `done`, `todo`, `status=`, `daily`)

### Bookmarks
- `bookmark` — Bookmark hinzufügen (`file=`, `subpath=`, `folder=`, `search=`, `url=`, `title=`)
- `bookmarks` — auflisten (`total`, `verbose`, `format=`)

### Bases
- `bases` — Base-Dateien im Vault auflisten
- `base:views` — Views der aktuellen Base
- `base:query` — Base abfragen (`view=`, `format=json|csv|tsv|md|paths`)
- `base:create` — Item in Base erstellen (`view=`, `name=`, `content=`, `open`, `newtab`)

### Daily Notes
- `daily` — öffnen (`paneType=tab|split|window`)
- `daily:path` / `daily:read`
- `daily:append` / `daily:prepend` — (`content=` required, `inline`, `open`, `paneType=`)

### Templates
- `templates` — auflisten (`total`)
- `template:insert name=<name>` — in aktive Datei einfügen
- `template:read name=<name>` — Inhalt lesen (`resolve`, `title=`)
- `templater:create-from-template template=<pfad> file=<pfad>` — (Templater-Plugin, `open`)

### History & Sync
- `history` — Versionen einer Datei
- `history:list` — Dateien mit Historie
- `history:open` / `history:read version=<n>` / `history:restore version=<n>`
- `diff` — lokale/Sync-Versionen vergleichen (`from=`, `to=`, `filter=local|sync`)
- `sync on|off` — Sync pausieren/fortsetzen
- `sync:status`, `sync:deleted`, `sync:history`, `sync:open`, `sync:read version=<n>`, `sync:restore version=<n>`

### Plugins, Themes, Snippets
- `plugins` / `plugins:enabled` (`filter=core|community`, `versions`, `format=`)
- `plugin id=<id>` — Info
- `plugin:enable` / `plugin:disable` / `plugin:install` / `plugin:uninstall` / `plugin:reload id=<id>`
- `plugins:restrict on|off` — Restricted Mode
- `themes` — auflisten (`versions`)
- `theme` — aktives Theme/Info (`name=`)
- `theme:set name=<name>` / `theme:install name=<name>` / `theme:uninstall name=<name>`
- `snippets` / `snippets:enabled`
- `snippet:enable name=<name>` / `snippet:disable name=<name>`

### Befehle & Hotkeys
- `commands` — verfügbare Obsidian-Befehle (`filter=<prefix>`)
- `command id=<command-id>` — ausführen
- `hotkeys` — auflisten (`total`, `verbose`, `format=`, `all`)
- `hotkey id=<command-id>` — Hotkey abfragen (`verbose`)

### Workspace & Tabs
- `workspace` — Workspace-Baum (`ids`)
- `tabs` — offene Tabs (`ids`)
- `tab:open` — neuen Tab öffnen (`group=`, `file=`, `view=`)

### App-Steuerung
- `reload` — Vault neu laden
- `restart` — App neu starten
- `version` — Obsidian-Version
- `help [<command>]` — Hilfe

### Entwickler-Tools (dev:*)
- `eval code=<js>` — JavaScript ausführen, Ergebnis zurückgeben
- `dev:dom selector=<css>` — DOM-Query (`total`, `text`, `inner`, `all`, `attr=`, `css=`)
- `dev:css selector=<css>` — CSS mit Quell-Angabe (`prop=`)
- `dev:console` — erfasste Konsolennachrichten (`clear`, `limit=`, `level=log|warn|error|info|debug`)
- `dev:errors` — erfasste Fehler (`clear`)
- `dev:screenshot path=<datei>` — Screenshot
- `dev:mobile on|off` — Mobile-Emulation
- `dev:debug on|off` — Chrome DevTools Protocol Debugger
- `dev:cdp method=<CDP.method> params=<json>` — CDP-Befehl
- `devtools` — Electron DevTools umschalten

## In diesem Vault

Für reine Datei-Lese-/Schreiboperationen bleiben die normalen Read/Edit/Write-Tools meist
einfacher und schneller. Die CLI lohnt sich für Obsidian-eigene Semantik, die sich nicht
1:1 aus dem Dateisystem ablesen lässt — und damit für genau die Fragen, die im Speaker
Management System ständig aufkommen (Feldnamen siehe Skill `sms-datenmodell`):

```bash
# Welche Statuswerte kommen bei den Engagements vor, und wie oft?
obsidian properties name=status counts

# Wo taucht dieser Speaker auf? Seine Backlinks sind seine Historie.
obsidian backlinks 'file=<Speakername>'

# Checklisten-Fortschritt einer Notiz gegenprüfen, ohne ihn nachzurechnen
obsidian tasks 'path=<Pfad zur Notiz>.md' verbose

# Notizen ohne type-Feld finden, die deshalb in keiner Sicht auftauchen
obsidian properties name=type counts
```

So lassen sich Aussagen über den Vault unabhängig von der Fachlogik des Plugins
gegenprüfen — nützlich als zweite Quelle, wenn eine Sicht etwas anderes zeigt als
erwartet.
