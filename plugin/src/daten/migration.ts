import { App, TFile } from "obsidian";
import { geruestzeile, namen, schemaFuer, type Notizschema } from "./schema";

/**
 * Was einer Notiz gegenüber dem heutigen Schema fehlt. Ermittelt am
 * **tatsächlichen Zustand** der Datei, nicht an einem Zähler: Liegt derselbe
 * Vault auf zwei Rechnern, sagt die lokale `data.json` womöglich „alt",
 * obwohl längst ergänzt wurde. Ein zweiter Lauf bleibt so folgenlos.
 */
export interface Nachtrag {
	datei: TFile;
	schema: Notizschema;
	/** Felder, die es im Frontmatter nicht gibt — auch nicht unter einem früheren Namen. */
	felder: string[];
	/** Abschnitte, deren Überschrift im Body fehlt. */
	abschnitte: string[];
}

/**
 * Ergänzt fehlende Felder und Abschnitte — **nur leer, nie einen vorhandenen
 * Wert**. Umformende Schritte (Umbenennen, Zusammenlegen) gehören später
 * hierher; sie wären alles oder nichts, während das Ergänzen je Notiz gehen
 * darf.
 */
export class Nachtragen {
	constructor(private app: App) {}

	/** Alle Notizen, denen etwas fehlt. Leere Liste heißt: alles auf Stand. */
	suchen(dateien: TFile[]): Nachtrag[] {
		return dateien
			.map((datei) => this.pruefen(datei))
			.filter((nachtrag): nachtrag is Nachtrag => nachtrag !== undefined);
	}

	pruefen(datei: TFile): Nachtrag | undefined {
		const cache = this.app.metadataCache.getFileCache(datei);
		const fm = cache?.frontmatter;
		const schema = schemaFuer(typeof fm?.type === "string" ? fm.type : "");
		if (!schema || !fm) return undefined;

		const felder = fehlendeFelder(schema, fm);
		const abschnitte = fehlendeAbschnitte(
			schema,
			(cache?.headings ?? []).map((kopf) => kopf.heading),
		);

		if (felder.length === 0 && abschnitte.length === 0) return undefined;
		return { datei, schema, felder, abschnitte };
	}

	async nachtragen(nachtrag: Nachtrag): Promise<void> {
		if (nachtrag.felder.length > 0) {
			await this.app.fileManager.processFrontMatter(nachtrag.datei, (fm) => {
				for (const name of nachtrag.felder) {
					const feld = nachtrag.schema.felder.find((eigenes) => eigenes.name === name);
					if (!feld) continue;
					// Listen als leere Liste, alles andere als leerer Wert — so
					// zeigt Obsidian die Eigenschaft an, ohne etwas zu behaupten.
					fm[name] = feld.art === "liste" || feld.art === "linkliste" ? [] : null;
				}
			});
		}

		if (nachtrag.abschnitte.length === 0) return;

		// Abschnitte hängen hinten an: Wo im Body sie hingehören, weiß nur der
		// Mensch — und die vorhandene Prosa anzufassen wäre der einzige Weg,
		// dabei etwas kaputt zu machen.
		const angehaengt = nachtrag.abschnitte
			.map((titel) => {
				const abschnitt = nachtrag.schema.abschnitte.find((eigener) => eigener.titel === titel);
				return [`## ${titel}`, ...(abschnitt?.zeilen ?? []), "", ""].join("\n");
			})
			.join("");

		const inhalt = await this.app.vault.read(nachtrag.datei);
		const getrennt = inhalt.endsWith("\n") ? "" : "\n";
		await this.app.vault.modify(nachtrag.datei, `${inhalt}${getrennt}\n${angehaengt}`);
	}

	/** Meldet, wie viele Notizen tatsächlich angefasst wurden. */
	async alleNachtragen(nachtraege: Nachtrag[]): Promise<number> {
		let gezaehlt = 0;
		for (const nachtrag of nachtraege) {
			await this.nachtragen(nachtrag);
			gezaehlt++;
		}
		return gezaehlt;
	}
}

/**
 * Welche Felder des Schemas im Frontmatter fehlen — auch unter einem früheren
 * Namen nicht da sind. Felder, die nicht ins Gerüst gehören, bleiben außen vor:
 * Eine leere `wahl` wäre eine Behauptung, keine Hilfe.
 */
export function fehlendeFelder(schema: Notizschema, fm: Record<string, unknown>): string[] {
	return schema.felder
		.filter((feld) => feld.imGeruest !== false)
		.filter((feld) => namen(feld).every((name) => !(name in fm)))
		.map((feld) => feld.name);
}

/** Welche Abschnitte des Schemas als Überschrift im Body fehlen. */
export function fehlendeAbschnitte(schema: Notizschema, ueberschriften: string[]): string[] {
	const vorhandene = new Set(ueberschriften);
	return schema.abschnitte
		.map((abschnitt) => abschnitt.titel)
		.filter((titel) => !vorhandene.has(titel));
}

/** „14 Speaker, 21 Engagements" — für die Rückfrage vor dem Schreiben. */
export function nachAgeordnet(nachtraege: Nachtrag[]): string {
	const jeTyp = new Map<string, number>();
	for (const nachtrag of nachtraege) {
		jeTyp.set(nachtrag.schema.titel, (jeTyp.get(nachtrag.schema.titel) ?? 0) + 1);
	}
	return [...jeTyp.entries()].map(([titel, anzahl]) => `${anzahl} × ${titel}`).join(", ");
}
