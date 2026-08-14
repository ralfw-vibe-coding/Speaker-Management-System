import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { dokuSchreiben } from "../src/vaultdoku";

/**
 * Der Fall, der in Wahrheit zählt, ist der frisch über BRAT bestückte, sonst
 * leere Vault: kein `.claude`, keine CLAUDE.md, keine Ordner. Dass die Doku
 * dort ankommt, lässt sich ohne Obsidian prüfen — der Adapter ist die einzige
 * Berührung mit der App, und den kann man nachstellen.
 */
function vaultAttrappe(vorhanden: Record<string, string> = {}) {
	const dateien = new Map<string, string>(Object.entries(vorhanden));
	const ordner = new Set<string>();

	const adapter = {
		exists: async (pfad: string) => dateien.has(pfad) || ordner.has(pfad),
		write: async (pfad: string, inhalt: string) => {
			const eltern = pfad.split("/").slice(0, -1).join("/");
			if (eltern && !ordner.has(eltern)) {
				throw new Error(`Ordner fehlt: ${eltern}`);
			}
			dateien.set(pfad, inhalt);
		},
		mkdir: async (pfad: string) => {
			ordner.add(pfad);
		},
	};

	return { app: { vault: { adapter } } as unknown as App, dateien, ordner };
}

const SKILL_DATENMODELL = ".claude/skills/sms-datenmodell/SKILL.md";
const SKILL_CLI = ".claude/skills/obsidian-cli/SKILL.md";

describe("Doku in einen leeren Vault schreiben", () => {
	it("legt CLAUDE.md und beide Skills an", async () => {
		const { app, dateien } = vaultAttrappe();

		const ergebnis = await dokuSchreiben(app);

		assert.deepEqual(ergebnis.geschrieben.sort(), [
			".claude/skills/obsidian-cli/SKILL.md",
			".claude/skills/sms-datenmodell/SKILL.md",
			"CLAUDE.md",
		]);
		assert.ok(dateien.has("CLAUDE.md"));
		assert.ok(dateien.has(SKILL_DATENMODELL));
		assert.ok(dateien.has(SKILL_CLI));
	});

	it("legt die Ordner über den Skills an — `.claude` gibt es im leeren Vault nicht", async () => {
		const { app, ordner } = vaultAttrappe();

		await dokuSchreiben(app);

		assert.ok(ordner.has(".claude"));
		assert.ok(ordner.has(".claude/skills"));
		assert.ok(ordner.has(".claude/skills/sms-datenmodell"));
		assert.ok(ordner.has(".claude/skills/obsidian-cli"));
	});

	it("schreibt Inhalt, nicht Leeres — der Text kommt beim Bauen ins Bundle", async () => {
		const { app, dateien } = vaultAttrappe();

		await dokuSchreiben(app);

		// Ohne den Markdown-Loader in esbuild wären das leere Strings.
		assert.ok(dateien.get("CLAUDE.md")!.includes("Speaker Management System"));
		assert.ok(dateien.get(SKILL_DATENMODELL)!.includes("name: sms-datenmodell"));
		assert.ok(dateien.get(SKILL_CLI)!.includes("name: obsidian-cli"));
	});

	it("stellt klar, dass das Frontmatter YAML ist", async () => {
		const { app, dateien } = vaultAttrappe();

		await dokuSchreiben(app);

		assert.ok(dateien.get(SKILL_DATENMODELL)!.includes("YAML, nicht JSON"));
	});
});

describe("Doku in einen Vault schreiben, in dem schon etwas steht", () => {
	it("lässt eine vorhandene CLAUDE.md unangetastet", async () => {
		const eigenes = "# Meine eigenen Notizen zum Vault\n";
		const { app, dateien } = vaultAttrappe({ "CLAUDE.md": eigenes });

		const ergebnis = await dokuSchreiben(app);

		assert.equal(dateien.get("CLAUDE.md"), eigenes);
		assert.deepEqual(ergebnis.uebersprungen, ["CLAUDE.md"]);
		assert.ok(!ergebnis.geschrieben.includes("CLAUDE.md"));
	});

	it("überschreibt sie erst, wenn es ausdrücklich verlangt wird", async () => {
		const { app, dateien } = vaultAttrappe({ "CLAUDE.md": "# Meins\n" });

		const ergebnis = await dokuSchreiben(app, true);

		assert.ok(dateien.get("CLAUDE.md")!.includes("Speaker Management System"));
		assert.deepEqual(ergebnis.uebersprungen, []);
	});

	it("frischt die Skills auch dann auf — sie gehören dem Plugin", async () => {
		const { app, dateien } = vaultAttrappe({ [SKILL_DATENMODELL]: "veraltet" });

		await dokuSchreiben(app);

		assert.ok(dateien.get(SKILL_DATENMODELL)!.includes("name: sms-datenmodell"));
	});

	it("kommt mit einem schon vorhandenen .claude-Ordner zurecht", async () => {
		const { app, ordner } = vaultAttrappe();
		await dokuSchreiben(app);
		const vorher = ordner.size;

		await dokuSchreiben(app);

		assert.equal(ordner.size, vorher);
	});
});
