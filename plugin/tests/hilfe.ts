import type { Beitrag, Block, Engagement, Konferenz, Tag, Track } from "../src/daten/modell";

/**
 * Kleine Bausteine für die Tests. Sie bilden den Test-Vault nach, aber nur so
 * weit, wie die Fachlogik ihn braucht: `datei` ist ein Platzhalter, weil keine
 * der geprüften Funktionen Obsidian anfasst.
 */

let laufend = 0;

/** Eine Datei, die es nicht gibt — die Fachlogik unterscheidet sie nur. */
function datei(name: string): Beitrag["datei"] {
	return { path: `${name}.md`, basename: name } as Beitrag["datei"];
}

export function block(id: string, von: string, bis: string, extra: Partial<Block> = {}): Block {
	return { id, von, bis, plenar: false, nur: [], ...extra };
}

export function track(id: string, name: string, extra: Partial<Track> = {}): Track {
	return { id, name, ...extra };
}

export function tag(datum: string, tracks: string[], bloecke: Block[]): Tag {
	return { datum, tracks, bloecke };
}

export function konferenz(teile: Partial<Konferenz> = {}): Konferenz {
	return {
		datei: datei("Testkonferenz"),
		name: "Testkonferenz",
		tracks: [],
		tage: [],
		slots: [],
		...teile,
	};
}

export function beitrag(teile: Partial<Beitrag> = {}): Beitrag {
	return {
		datei: datei(`Beitrag ${++laufend}`),
		konferenz: "Testkonferenz",
		speaker: [],
		bloecke: [],
		aufgaben: { erledigt: 0, gesamt: 0 },
		...teile,
	};
}

export function engagement(teile: Partial<Engagement> = {}): Engagement {
	return {
		datei: datei(`Engagement ${++laufend}`),
		konferenz: "Testkonferenz",
		speaker: "Wer Auchimmer",
		status: "gemerkt",
		position: 0,
		aufgaben: { erledigt: 0, gesamt: 0 },
		...teile,
	};
}
