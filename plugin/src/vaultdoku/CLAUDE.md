# Dieser Vault: Speaker Management System

Dieser Vault ist der Datenbestand eines **Content Managers für Konferenzen**. Verwaltet
wird er vom Obsidian-Plugin *Speaker Management System* (SMS). Die Aufgabe dahinter:
Speaker über Jahre katalogisieren, sie je Konferenz durch einen Akquise-Funnel führen
und ihre Beiträge in die Tagesagenden einplanen.

## Die fünf Notiztypen

Jede vom Plugin verwaltete Notiz trägt im Frontmatter ein Feld `type`:

| `type` | Was es ist |
|---|---|
| `speaker` | Eine Person im Katalog, konferenzübergreifend. |
| `veranstalter` | Der Auftraggeber einer Konferenz. Kommt über Jahre wieder. |
| `konferenz` | Das mehrtägige Ereignis, samt Raster aus Tagen, Tracks und Blöcken. |
| `engagement` | Die Beziehung Speaker × Konferenz: Funnel-Status, Honorar, Checkliste. |
| `beitrag` | Was in einem Slot stattfindet: Keynote, Vortrag, Workshop, Panel, Moderation. |

Alles Konferenzspezifische liegt im Ordner seiner Konferenz:

```
speaker/
  <Name der Person>.md
veranstalter/
  <Name der Firma>.md
konferenzen/
  <Konferenzname>/
    <Konferenzname>.md
    engagements/
      <Konferenzname> – <Name der Person>.md
    beiträge/
      <Konferenzname> – <Titel>.md
```

Die drei obersten Ordnernamen sind in den Plugin-Einstellungen konfigurierbar und
können abweichen.

## Vier Regeln, die man nicht verletzen darf

**1. Das Frontmatter ist YAML, nicht JSON.** Auch das Raster einer Konferenz — die
Tage, Tracks und Blöcke — steht als verschachteltes YAML. Obsidians
Eigenschaften-Panel *zeigt* verschachtelte Werte JSON-artig an; in der Datei steht
YAML. Wer JSON hineinschreibt, zerlegt das Frontmatter, und die Konferenz verliert auf
einen Schlag auch Veranstalter, Budget und Deadline.

**2. Der Dateiname ist die Identität.** Obsidian löst Wikilinks über den Dateinamen
auf, nicht über den Pfad. Deshalb muss jeder Name vault-weit eindeutig sein, und
deshalb tragen Engagements und Beiträge den Konferenznamen als Präfix. Umbenennen nur
über Obsidian, damit die Links mitwandern.

**3. Nichts Abgeleitetes speichern.** Die Sichten des Plugins sind Projektionen:
Summen, Fortschrittsbalken, Belegungen und Historien werden gerechnet. Ein Engagement
führt daher keine Liste seiner Beiträge, und eine Konferenz keine Honorarsumme. Eine
solche Zahl zusätzlich abzulegen erzeugt eine zweite Wahrheit, die veraltet.

**4. Eng schreiben, tolerant lesen.** Beim Ändern einer Notiz nur die Felder anfassen,
um die es geht — Body und fremde Felder bleiben unberührt. Fehlende Felder sind kein
Fehler, sondern der Normalfall am Anfang der Planung.

## Wenn es genauer sein muss

- **`sms-datenmodell`** — die vollständige Feldreferenz je Notiztyp, die zulässigen
  Werte und vor allem die Kodierung des Agenda-Rasters. Vor jedem Schreibzugriff auf
  eine Konferenz-, Engagement- oder Beitragsnotiz lesen.
- **`obsidian-cli`** — Obsidians eingebaute Kommandozeile für Backlinks, Properties,
  Tasks und Tags, wenn die Frage von Obsidians eigener Metadaten-Logik profitiert.

## Eigene Notizen sind erlaubt

Im Ordner einer Konferenz darf **alles liegen, was man selbst ablegen will** —
Gesprächsnotizen, Angebote, Skizzen, Checklisten. Das Plugin zeigt sie nirgends an und
beanstandet sie auch nicht; sie brauchen kein Frontmatter und kein `type`.

Zuständig ist das Plugin nur dort, wo es selbst ablegt:

- alles in `engagements/` und `beiträge/`
- die Konferenznotiz, die wie ihr Ordner heißt

Dort ist ein fehlendes `type` ein Fehler und wird gemeldet — sonst verschwände eine
Notiz mit zerschossenem Frontmatter lautlos aus allen Sichten.

Im Speaker- und Veranstalterordner gilt dasselbe strenger: Sie sind flach und enthalten
nur, was sie im Namen tragen. Wer dort trotzdem etwas Eigenes ablegen will, schreibt
`type: notiz` ins Frontmatter — dieser Wert heißt „gehört mir, nicht dem Plugin".

## Womit man rechnen muss

Normalerweise legt **das Plugin** diese Notizen an und pflegt ihr Frontmatter; von Hand
geschrieben wird der Freitext im Body. Wer von außen schreibt, übernimmt damit die
Verantwortung für Namenseindeutigkeit und Feldform — beides prüft das Plugin beim Lesen
nur so weit, dass es nicht abstürzt. Eine Notiz mit **unbekanntem** `type` taucht in
keiner Sicht auf; sie sammelt das Plugin in der Konferenzübersicht als Beanstandung ein.
Dasselbe gilt für ein **fehlendes** `type` an den Stellen, an denen eines hingehört —
siehe oben. Freie Notizen bleiben unbehelligt.
