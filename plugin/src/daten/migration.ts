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

	/**
	 * Trägt nach — **als Texteinschub, nicht über `processFrontMatter`.** Die
	 * API gibt das Frontmatter geparst zurück und schreibt anschließend den
	 * ganzen Block neu, mit ihrem eigenen YAML-Stil; aus `themen: [a, b]` würde
	 * eine mehrzeilige Liste. Beim Ändern eines Wertes nehmen wir das in Kauf,
	 * weil YAML von Hand zu erzeugen die fragilere Wahl wäre. Hier aber wird nur
	 * angefügt, nie geändert — und dafür genügt eine eingeschobene Zeile, die
	 * alles andere unangetastet lässt.
	 */
	async nachtragen(nachtrag: Nachtrag): Promise<void> {
		const zeilen = nachtrag.felder
			.map((name) => nachtrag.schema.felder.find((feld) => feld.name === name))
			.filter((feld): feld is NonNullable<typeof feld> => feld !== undefined)
			.map((feld) => geruestzeile(feld));

		const abschnitte = nachtrag.abschnitte.map((titel) => {
			const abschnitt = nachtrag.schema.abschnitte.find((eigener) => eigener.titel === titel);
			return { titel, zeilen: abschnitt?.zeilen ?? [] };
		});

		const inhalt = await this.app.vault.read(nachtrag.datei);
		const ergaenzt = ergaenzen(inhalt, zeilen, abschnitte);
		if (ergaenzt === inhalt) return;

		await this.app.vault.modify(nachtrag.datei, ergaenzt);
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
 * Schiebt Feldzeilen vor das schließende `---` und hängt fehlende Abschnitte
 * hinten an. Reiner Text, keine Zeile wird angefasst, die schon dasteht.
 *
 * Abschnitte kommen ans Ende, weil nur der Mensch weiß, wo im Body sie
 * hingehören — die vorhandene Prosa umzusortieren wäre der einzige Weg, dabei
 * etwas kaputt zu machen.
 */
export function ergaenzen(
	inhalt: string,
	feldzeilen: string[],
	abschnitte: { titel: string; zeilen: string[] }[],
): string {
	let zeilen = inhalt.split("\n");

	if (feldzeilen.length > 0 && zeilen[0] === "---") {
		const ende = zeilen.indexOf("---", 1);
		if (ende > 0) zeilen = [...zeilen.slice(0, ende), ...feldzeilen, ...zeilen.slice(ende)];
	}

	let text = zeilen.join("\n");

	for (const abschnitt of abschnitte) {
		const getrennt = text.endsWith("\n") ? "" : "\n";
		text += `${getrennt}\n## ${abschnitt.titel}\n${abschnitt.zeilen.map((z) => `${z}\n`).join("")}\n`;
	}
	return text;
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
