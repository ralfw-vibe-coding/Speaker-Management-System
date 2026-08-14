import type { App } from "obsidian";
import claudeMd from "./CLAUDE.md";
import datenmodell from "./sms-datenmodell.md";
import obsidianCli from "./obsidian-cli.md";

/**
 * Die Dokumentation, die eine Claude-Session im Vault vorfinden soll.
 *
 * Sie liegt hier als Quelle und wird beim Bauen ins Bundle eingesetzt, damit
 * jeder Vault sie mitbekommt — auch die, die über BRAT leer starten. Ohne das
 * müsste jeder Vault von Hand bestückt werden, und die Beschreibung würde nach
 * ein paar Versionen lügen.
 */

/** Ein Skill gehört uns: Es wird angelegt und bei neuer Version überschrieben. */
const SKILLS = [
	{ pfad: ".claude/skills/sms-datenmodell/SKILL.md", inhalt: datenmodell },
	{ pfad: ".claude/skills/obsidian-cli/SKILL.md", inhalt: obsidianCli },
];

/**
 * CLAUDE.md gehört dagegen dem Nutzer — dort steht womöglich schon anderes.
 * Sie wird nur angelegt, wenn es keine gibt, und nie überschrieben.
 */
const CLAUDE_MD = "CLAUDE.md";

export interface DokuErgebnis {
	geschrieben: string[];
	uebersprungen: string[];
}

/**
 * Schreibt die Dokumentation in den Vault.
 *
 * `erzwingen` überschreibt auch eine vorhandene CLAUDE.md — das macht nur der
 * Befehl von Hand, nicht der Start des Plugins.
 */
export async function dokuSchreiben(app: App, erzwingen = false): Promise<DokuErgebnis> {
	const adapter = app.vault.adapter;
	const geschrieben: string[] = [];
	const uebersprungen: string[] = [];

	for (const skill of SKILLS) {
		await ordnerAnlegen(app, skill.pfad);
		await adapter.write(skill.pfad, skill.inhalt);
		geschrieben.push(skill.pfad);
	}

	if (erzwingen || !(await adapter.exists(CLAUDE_MD))) {
		await adapter.write(CLAUDE_MD, claudeMd);
		geschrieben.push(CLAUDE_MD);
	} else {
		uebersprungen.push(CLAUDE_MD);
	}

	return { geschrieben, uebersprungen };
}

/**
 * Legt die Ordner über einer Datei an. `.claude` beginnt mit einem Punkt und
 * ist damit für Obsidian unsichtbar — deshalb läuft das über den Adapter und
 * nicht über `vault.createFolder`.
 */
async function ordnerAnlegen(app: App, dateipfad: string): Promise<void> {
	const teile = dateipfad.split("/").slice(0, -1);
	let pfad = "";
	for (const teil of teile) {
		pfad = pfad ? `${pfad}/${teil}` : teil;
		if (!(await app.vault.adapter.exists(pfad))) {
			await app.vault.adapter.mkdir(pfad);
		}
	}
}
