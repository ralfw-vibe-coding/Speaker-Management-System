# SMS – Speaker Management System

Obsidian-Plugin für das Content Management von Konferenzen. Konzept und
UI-Entwürfe liegen in [docs/Konzept.md](docs/Konzept.md).

## Aufbau

```
plugin/                                 das Obsidian-Plugin
Speaker Management System Test Vault/   Vault zum Entwickeln; das Plugin ist
                                        per Symlink eingebunden
docs/                                   Konzept und UI-Entwürfe
```

Der Symlink `Speaker Management System Test Vault/.obsidian/plugins/speaker-management-system` zeigt auf
`plugin/`. Ein Build landet damit direkt im Vault — kein Kopieren nötig.

## Entwickeln

```bash
cd plugin && npm install && npm run dev
```

`npm run dev` baut bei jeder Änderung neu. In Obsidian lädt man das Plugin
danach mit *Reload app without saving* (Cmd+R) oder dem Hot-Reload-Plugin neu.

`npm run build` erzeugt den Produktionsbuild und prüft vorher die Typen.

Den Vault öffnet man in Obsidian über *Open folder as vault* mit dem Ordner
`Speaker Management System Test Vault`. Das Plugin ist dort bereits aktiviert.
