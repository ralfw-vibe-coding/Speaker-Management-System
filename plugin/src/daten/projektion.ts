import { ZUGESAGT_UND_WEITER, type Beitrag, type Block, type Engagement, type Konferenz, type Tag } from "./modell";

/**
 * Die Regeln, nach denen die Sichten rechnen — ohne Obsidian und ohne DOM,
 * damit sie prüfbar sind. Was hier steht, ist Fachlogik aus dem Konzept, nicht
 * Darstellung.
 */

/** Der Reifegrad eines Slots — das Minimum aus eigener Füllung und Engagement. */
export type Zustand = "leer" | "halb" | "verdacht" | "gruen";

export function slotZustand(
	beitrag: Beitrag | undefined,
	engagement: Engagement | undefined,
): Zustand {
	if (!beitrag) return "leer";
	if (!beitrag.titel || beitrag.speaker.length === 0) return "halb";
	if (engagement && ZUGESAGT_UND_WEITER.includes(engagement.status)) return "gruen";
	return "verdacht";
}

/**
 * Heimatlos ist ein Beitrag, dessen Slot es nicht mehr gibt: Der Block fehlt im
 * Raster, oder sein Track ist an diesem Tag nicht dabei. Ein Beitrag ganz ohne
 * Block liegt dagegen im Pool und ist nicht heimatlos.
 */
export function heimatlos(beitrag: Beitrag, konferenz: Konferenz): boolean {
	if (beitrag.bloecke.length === 0) return false;

	const tag = konferenz.tage.find((t) =>
		t.bloecke.some((block) => beitrag.bloecke.includes(block.id)),
	);
	if (!tag) return true;
	if (!beitrag.track) return false;

	if (!konferenz.tracks.some((track) => track.id === beitrag.track)) return true;
	return tag.tracks.length > 0 && !tag.tracks.includes(beitrag.track);
}

/** `09:45` wird zu 585. Fehlt die Zeit, ist sie null wert. */
export function minuten(zeit?: string): number {
	const treffer = /^(\d{1,2}):(\d{2})/.exec(zeit ?? "");
	if (!treffer) return 0;
	return Number(treffer[1]) * 60 + Number(treffer[2]);
}

/** Schiebt eine Uhrzeit um Minuten, innerhalb desselben Tages. */
export function verschoben(zeit: string | undefined, um: number): string | undefined {
	if (!zeit) return zeit;
	const gesamt = Math.max(0, Math.min(24 * 60 - 1, minuten(zeit) + um));
	const stunde = String(Math.floor(gesamt / 60)).padStart(2, "0");
	const rest = String(gesamt % 60).padStart(2, "0");
	return `${stunde}:${rest}`;
}

export function nachZeit(bloecke: Block[]): Block[] {
	return [...bloecke].sort((a, b) => (a.von ?? "").localeCompare(b.von ?? ""));
}

/**
 * Wie viel Zeit die belegten Blöcke zusammen hergeben. Fixblöcke, über die ein
 * langer Workshop hinwegläuft, zählen nicht mit — in der Kaffeepause arbeitet
 * niemand.
 */
export function dauerImRaster(beitrag: Beitrag, tag: Tag): number {
	return tag.bloecke
		.filter((block) => beitrag.bloecke.includes(block.id))
		.reduce((summe, block) => summe + Math.max(0, minuten(block.bis) - minuten(block.von)), 0);
}

/** Wie viele Blöcke eines Tages in den vorherigen hineinragen. */
export function ueberschneidungen(tag: Tag): number {
	let strittig = 0;
	let vorherBis: string | undefined;
	for (const block of nachZeit(tag.bloecke)) {
		if (vorherBis && block.von && minuten(block.von) < minuten(vorherBis)) strittig++;
		vorherBis = block.bis ?? vorherBis;
	}
	return strittig;
}

/** Slots dieses Tages, in denen mehr als ein Beitrag steht. */
export function doppeltBelegte(tag: Tag, beitraege: Beitrag[]): number {
	let doppelt = 0;
	for (const block of tag.bloecke) {
		if (block.fix) continue;

		const hier = beitraege.filter((beitrag) => beitrag.bloecke.includes(block.id));
		if (block.plenar) {
			if (hier.length > 1) doppelt++;
			continue;
		}

		const jeTrack = new Map<string, number>();
		for (const beitrag of hier) {
			const schluessel = beitrag.track ?? "";
			jeTrack.set(schluessel, (jeTrack.get(schluessel) ?? 0) + 1);
		}
		for (const anzahl of jeTrack.values()) if (anzahl > 1) doppelt++;
	}
	return doppelt;
}

/** Speaker, die an diesem Tag in zwei gleichzeitigen Beiträgen stehen. */
export function parallelStehende(tag: Tag, beitraege: Beitrag[]): number {
	const namen = new Set<string>();
	for (const block of tag.bloecke) {
		const hier = beitraege.filter((beitrag) => beitrag.bloecke.includes(block.id));
		const gesehen = new Set<string>();
		for (const beitrag of hier) {
			for (const speaker of beitrag.speaker) {
				if (gesehen.has(speaker)) namen.add(speaker);
				gesehen.add(speaker);
			}
		}
	}
	return namen.size;
}

/**
 * Andere Beiträge desselben Speakers, die sich mit diesem einen Block teilen.
 * Bei parallelen Tracks ist das ein Fehler im Programm, den man beim Ziehen
 * nicht sieht — man schaut auf die Spalte, nicht auf die Zeile.
 */
export function zeitgleich(beitrag: Beitrag, alle: Beitrag[]): Beitrag[] {
	const speaker = beitrag.speaker[0];
	if (!speaker) return [];

	return alle.filter(
		(anderer) =>
			anderer.datei !== beitrag.datei &&
			anderer.speaker.includes(speaker) &&
			anderer.bloecke.some((id) => beitrag.bloecke.includes(id)),
	);
}

/**
 * Wohin ein gezogener Beitrag kommt. Seine Länge bleibt erhalten: Ein Workshop
 * über zwei Blöcke bleibt beim Umziehen zwei Blöcke lang, gerechnet ab dem
 * Zielblock. Fixblöcke zählen nicht mit.
 */
export function zielBloecke(beitrag: Beitrag, tag: Tag, blockId: string): string[] {
	const gewuenscht = Math.max(1, beitrag.bloecke.length);
	const sortiert = nachZeit(tag.bloecke);
	const start = sortiert.findIndex((block) => block.id === blockId);
	if (start < 0) return [blockId];

	const ids: string[] = [];
	for (let i = start; i < sortiert.length && ids.length < gewuenscht; i++) {
		if (sortiert[i].fix) continue;
		ids.push(sortiert[i].id);
	}
	return ids;
}
