import { ZUGESAGT_UND_WEITER, type Auftritt, type Beitrag, type Block, type Engagement, type Konferenz, type Tag } from "./modell";

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

/** Was in der Konzeption steht und welches Raster daraus folgt. */
export interface Entwurfsbild {
	/** Ideen, die noch im Rennen sind. */
	ideen: number;
	/** Aussortiert, aber aufgehoben. */
	verworfen: number;
	/** Ideen, die noch keinem Strang zugeordnet sind. */
	ohneStrang: number;
	/** Wie viele Blöcke das Programm bräuchte, wenn alle Stränge parallel laufen. */
	bloecke: number;
	/** Je Strang: wie viele Blöcke er füllt. Der längste bestimmt das Raster. */
	proStrang: Map<string, number>;
}

/**
 * Rechnet aus den Ideen das Raster, das sie aufnehmen müsste.
 *
 * Die Stränge laufen parallel, also bestimmt der **längste** die Zahl der
 * Blöcke — nicht die Summe. Ein Beitrag, der länger dauert als ein Block,
 * zählt entsprechend mehrfach; ohne Angabe zählt er einfach.
 *
 * Ideen ohne Strang bleiben aussen vor: Sie stehen noch nicht im Programm,
 * sondern daneben. Sie werden getrennt ausgewiesen, damit man sieht, dass die
 * Rechnung noch nicht alles umfasst.
 */
export function entwurfsbild(beitraege: Beitrag[], takt = 45): Entwurfsbild {
	const lebendig = beitraege.filter((beitrag) => !beitrag.verworfenAm);
	const proStrang = new Map<string, number>();

	for (const beitrag of lebendig) {
		if (!beitrag.strang) continue;
		const einheiten = beitrag.dauer && takt > 0 ? Math.max(1, Math.ceil(beitrag.dauer / takt)) : 1;
		proStrang.set(beitrag.strang, (proStrang.get(beitrag.strang) ?? 0) + einheiten);
	}

	return {
		ideen: lebendig.length,
		verworfen: beitraege.length - lebendig.length,
		ohneStrang: lebendig.filter((beitrag) => !beitrag.strang).length,
		bloecke: Math.max(0, ...proStrang.values()),
		proStrang,
	};
}

/** Die Historie eines Speakers, geteilt in das, was läuft, und das, was war. */
export interface Historienbild {
	/** Konferenzen, an denen noch etwas offen ist — einzeln zu zeigen. */
	laufend: Auftritt[];
	/** Abgeschlossene Konferenzen — nur zu zählen. */
	frueher: Auftritt[];
	/** Mittel über die **bewerteten** früheren — unbewertete zählen nicht als null. */
	schnitt?: number;
}

/**
 * Teilt die Auftritte eines Speakers in laufende und frühere.
 *
 * Bei einer laufenden Konferenz will man den Funnel-Status wissen: Da steht
 * etwas offen, man wartet auf Antwort. Bei einer gelaufenen ist er immer
 * derselbe und sagt nichts mehr — dort interessiert die Bewertung. Deshalb
 * stehen die einen einzeln und werden die anderen gezählt; sonst wüchse die
 * Karte mit jedem Jahr, in dem jemand wieder gebucht wird.
 *
 * Die Grenze zieht der **Konferenzstatus**, nicht das Datum: Er wird ohnehin
 * gepflegt und ist die verbindliche Aussage darüber, ob etwas vorbei ist.
 */
export function historienbild(auftritte: Auftritt[]): Historienbild {
	const vorbei = (auftritt: Auftritt) =>
		auftritt.konferenzstatus === "gelaufen" || auftritt.konferenzstatus === "abgesagt";

	const frueher = auftritte.filter(vorbei);

	// Ein fehlender Wert ist hier „unbekannt", nicht null: Wer nie bewertet
	// wurde, zöge einen Schnitt sonst nach unten, ohne dass etwas passiert ist.
	const noten = frueher
		.map((auftritt) => auftritt.bewertung)
		.filter((note): note is number => note !== undefined);

	return {
		laufend: auftritte.filter((auftritt) => !vorbei(auftritt)),
		frueher,
		schnitt: noten.length > 0 ? noten.reduce((a, b) => a + b, 0) / noten.length : undefined,
	};
}

/**
 * Trägt dieses Engagement die Rolle? Tolerant gelesen — Groß- und Kleinschreibung
 * und Leerraum sind von Hand geschrieben schnell verschieden.
 */
export function hatRolle(engagement: Engagement, rolle: string): boolean {
	return engagement.rollen.some((eigene) => eigene.trim().toLowerCase() === rolle);
}

/**
 * Erwartet dieses Engagement noch einen Beitrag im Raster?
 *
 * Wer eine Rolle hat, führt durch den Tag, statt einen Slot zu belegen — der
 * fehlende Beitrag ist dann kein Rückstand, sondern die Sache selbst. Ohne
 * diese Unterscheidung stünde die Moderatorin bis zum Konferenztag unter
 * „Kandidaten ohne Beitrag" und mahnte etwas an, das nie kommt.
 *
 * Wer moderiert **und** einen Vortrag hält, hat einen Beitrag; der steht dann
 * ganz normal im Raster. Diese Frage stellt sich nur, solange keiner da ist.
 */
export function erwartetBeitrag(engagement: Engagement): boolean {
	return engagement.rollen.length === 0;
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
 * Die Plätze eines Slots: das Minimum aus dem, was der Beitrag verträgt, und
 * dem, was der Raum fasst. Nur eine der beiden Zahlen zu nehmen wäre falsch —
 * die eine ist ein Wunsch, die andere eine Wand.
 *
 * `undefined` heißt: nicht bezifferbar. Ein leerer Slot bietet niemandem einen
 * Platz, und ein Beitrag ohne beide Angaben sagt nichts über seine Größe.
 */
export function plaetzeEinesSlots(
	beitrag: Beitrag | undefined,
	kapazitaet: number | undefined,
): number | undefined {
	if (!beitrag) return undefined;

	const zahlen = [beitrag.maxTeilnehmer, kapazitaet].filter(
		(wert): wert is number => wert !== undefined,
	);
	return zahlen.length === 0 ? undefined : Math.min(...zahlen);
}

/** Was eine Blockzeile insgesamt aufnimmt. */
export interface Blockplaetze {
	/** Summe über die Slots, die belegt sind und eine Zahl haben. */
	plaetze: number;
	/** Belegte Slots, zu denen weder Beitrag noch Raum etwas sagen. */
	unbekannt: number;
	/** Slots ohne Beitrag — sie bieten niemandem einen Platz. */
	frei: number;
}

/**
 * Wie viele Menschen das Programm zu dieser Zeit aufnimmt. Gezählt werden nur
 * belegte Slots: Ein Raum, in dem nichts stattfindet, ist kein Angebot, auch
 * wenn Stühle darin stehen.
 */
export function plaetzeEinesBlocks(
	konferenz: Konferenz,
	tag: Tag,
	block: Block,
	beitraege: Beitrag[],
	kapazitaetVon: (blockId: string, trackId?: string) => number | undefined,
): Blockplaetze {
	const gezaehlt: Blockplaetze = { plaetze: 0, unbekannt: 0, frei: 0 };
	if (block.fix) return gezaehlt;

	const zaehlen = (trackId?: string) => {
		const beitrag = beitraege.find(
			(eigener) =>
				eigener.bloecke.includes(block.id) &&
				(trackId === undefined || eigener.track === trackId),
		);
		if (!beitrag) {
			gezaehlt.frei++;
			return;
		}
		const plaetze = plaetzeEinesSlots(beitrag, kapazitaetVon(block.id, trackId));
		if (plaetze === undefined) gezaehlt.unbekannt++;
		else gezaehlt.plaetze += plaetze;
	};

	if (block.plenar) {
		zaehlen();
		return gezaehlt;
	}

	for (const track of konferenz.tracks) {
		if (!tag.tracks.includes(track.id)) continue;
		if (block.nur.length > 0 && !block.nur.includes(track.id)) continue;
		zaehlen(track.id);
	}
	return gezaehlt;
}

/** Eine Notiz, die das Plugin nicht einordnen kann, samt Grund. */
export interface Beanstandung {
	datei: Beitrag["datei"];
	text: string;
}

/**
 * Verweise, die ins Leere zeigen. Der gefährlichste Fehler in diesem Entwurf
 * ist nicht der falsche Wert, sondern die Notiz, die stillschweigend
 * verschwindet: Zeigt ein Beitrag auf eine Konferenz, die es nicht gibt, taucht
 * er in keiner Sicht auf — und die Summe darunter wirkt trotzdem plausibel.
 */
export function verwaisteVerweise(
	beitraege: Beitrag[],
	engagements: Engagement[],
	konferenzen: Konferenz[],
	speakerNamen: string[],
): Beanstandung[] {
	const konferenzNamen = new Set(konferenzen.map((k) => k.name));
	const speaker = new Set(speakerNamen);
	const gefunden: Beanstandung[] = [];

	const konferenzPruefen = (datei: Beitrag["datei"], name: string) => {
		if (!name) gefunden.push({ datei, text: "ohne Konferenz" });
		else if (!konferenzNamen.has(name)) {
			gefunden.push({ datei, text: `zeigt auf die Konferenz „${name}“, die es nicht gibt` });
		}
	};

	for (const beitrag of beitraege) {
		konferenzPruefen(beitrag.datei, beitrag.konferenz);
		for (const name of beitrag.speaker) {
			if (!speaker.has(name)) {
				gefunden.push({ datei: beitrag.datei, text: `nennt „${name}“, den es im Katalog nicht gibt` });
			}
		}
	}

	for (const engagement of engagements) {
		konferenzPruefen(engagement.datei, engagement.konferenz);
		if (!engagement.speaker) {
			gefunden.push({ datei: engagement.datei, text: "ohne Speaker" });
		} else if (!speaker.has(engagement.speaker)) {
			gefunden.push({
				datei: engagement.datei,
				text: `zeigt auf „${engagement.speaker}“, den es im Katalog nicht gibt`,
			});
		}
	}

	return gefunden;
}

/** Ein Beitrag aus einem früheren Jahr, als Vorschlag beim Füllen eines Slots. */
export interface FruehererBeitrag {
	titel: string;
	konferenz: string;
	datum?: string;
	beitrag: Beitrag;
}

/**
 * Was dieser Speaker früher gehalten hat — alles außer der laufenden Konferenz,
 * die jüngste zuerst. Titellose Beiträge sind kein Vorschlag; sie sagen nichts.
 *
 * Das ist der Grund, warum der Katalog konferenzübergreifend ist: Wer jemanden
 * bucht, will wissen, womit er schon einmal da war.
 */
export function frueherGehalten(
	speaker: string,
	laufende: string,
	beitraege: Beitrag[],
	konferenzen: Konferenz[],
	hoechstens = 3,
): FruehererBeitrag[] {
	const datumVon = new Map(konferenzen.map((k) => [k.name, k.tage[0]?.datum]));

	return beitraege
		.filter(
			(beitrag) =>
				beitrag.konferenz !== laufende && beitrag.titel && beitrag.speaker.includes(speaker),
		)
		.map((beitrag) => ({
			titel: beitrag.titel as string,
			konferenz: beitrag.konferenz,
			datum: datumVon.get(beitrag.konferenz),
			beitrag,
		}))
		// Die jüngste zuerst; wer kein Datum hat, steht hinten.
		.sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? "") || a.titel.localeCompare(b.titel, "de"))
		.slice(0, hoechstens);
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
