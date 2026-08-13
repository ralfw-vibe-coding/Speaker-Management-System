import { Notice, type TFile } from "obsidian";
import type { Datenzugriff } from "../daten/lesen";
import type { Datenschreiber } from "../daten/schreiben";
import {
	FORMAT_TITEL,
	FUNNEL_TITEL,
	ZUGESAGT_UND_WEITER,
	raumFuer,
	type Beitrag,
	type Block,
	type Engagement,
	type Konferenz,
	type Tag,
} from "../daten/modell";

/** Der Reifegrad eines Slots — das Minimum aus eigener Füllung und Engagement. */
type Zustand = "leer" | "halb" | "verdacht" | "gruen";

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONATE_KURZ = [
	"Jan",
	"Feb",
	"Mär",
	"Apr",
	"Mai",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Okt",
	"Nov",
	"Dez",
];

/**
 * Die Agenda eines Konferenztages: das Raster als Gitter, Tracks als Spalten,
 * Blöcke als Zeilen. Daneben der Pool — Beiträge ohne Ort, sowohl noch nicht
 * platzierte als auch heimatlose.
 *
 * Wie die Statustafel hält sie keinen eigenen Zustand. Der leere Slot ist kein
 * Datenobjekt, sondern ein Loch: Kreuzprodukt aus Blöcken und Tracks, minus
 * Fixblöcke, minus Belegtes.
 */
export class Agenda {
	private tagIndex = 0;
	private gezogen: Beitrag | null = null;

	constructor(
		private daten: Datenzugriff,
		private schreiber: Datenschreiber,
		private notizOeffnen: (datei: TFile) => void,
	) {}

	async zeichnen(buehne: HTMLElement, konferenz: Konferenz | undefined): Promise<void> {
		buehne.empty();
		buehne.addClass("sms-agenda");

		if (!konferenz) {
			buehne.createEl("p", {
				cls: "sms-leer",
				text: "Keine Konferenz gefunden. Stimmt der Konferenzordner in den Einstellungen?",
			});
			return;
		}

		const beitraege = this.daten
			.beitraege()
			.filter((beitrag) => beitrag.konferenz === konferenz.name);
		const engagements = new Map(
			this.daten
				.engagements()
				.filter((engagement) => engagement.konferenz === konferenz.name)
				.map((engagement) => [engagement.speaker, engagement]),
		);

		if (this.tagIndex >= konferenz.tage.length) this.tagIndex = 0;
		const tag = konferenz.tage[this.tagIndex];

		this.kopfZeichnen(buehne, konferenz, tag, beitraege);

		if (konferenz.tage.length === 0) {
			buehne.createEl("p", {
				cls: "sms-leer",
				text: "Diese Konferenz hat keine Tage im Frontmatter — es gibt kein Raster zu zeigen.",
			});
			return;
		}

		const unten = buehne.createDiv({ cls: "sms-agenda-unten" });
		this.rasterZeichnen(unten, konferenz, tag, beitraege, engagements);
		this.poolZeichnen(unten, konferenz, beitraege, engagements);
	}

	// -------------------------------------------------------------- Zeichnen

	private kopfZeichnen(
		buehne: HTMLElement,
		konferenz: Konferenz,
		tag: Tag | undefined,
		beitraege: Beitrag[],
	): void {
		const kopf = buehne.createDiv({ cls: "sms-tafel-kopf" });

		const links = kopf.createDiv();
		links.createDiv({ cls: "sms-konferenz", text: konferenz.name });

		const untertitel = [konferenz.untertitel, konferenz.veranstalter].filter(
			(teil): teil is string => !!teil,
		);
		if (untertitel.length > 0) {
			links.createDiv({ cls: "sms-konferenz-zeile", text: untertitel.join(" · ") });
		}

		const loecher = tag ? this.loecher(konferenz, tag, beitraege) : 0;
		const imPool = beitraege.filter((beitrag) => !beitrag.block).length;
		const heimatlose = beitraege.filter((beitrag) => heimatlos(beitrag, konferenz)).length;

		const marken = kopf.createDiv({ cls: "sms-marken" });
		marken.createSpan({ cls: "sms-marke", text: `${loecher} Löcher an diesem Tag` });
		marken.createSpan({ cls: "sms-marke", text: `${imPool} im Pool` });
		if (heimatlose > 0) {
			marken.createSpan({ cls: "sms-marke sms-marke-rot", text: `${heimatlose} heimatlos` });
		}

		const reiter = buehne.createDiv({ cls: "sms-tage" });
		konferenz.tage.forEach((eigener, index) => {
			const knopf = reiter.createEl("button", {
				cls: index === this.tagIndex ? "sms-chip is-aktiv" : "sms-chip",
				text: tagesTitel(eigener, index),
			});
			knopf.addEventListener("click", () => {
				this.tagIndex = index;
				void this.zeichnen(buehne, konferenz);
			});
		});
	}

	private rasterZeichnen(
		eltern: HTMLElement,
		konferenz: Konferenz,
		tag: Tag | undefined,
		beitraege: Beitrag[],
		engagements: Map<string, Engagement>,
	): void {
		const raster = eltern.createDiv({ cls: "sms-raster" });
		if (!tag) return;

		const tracks = konferenz.tracks.filter((track) => tag.tracks.includes(track.id));
		if (tracks.length === 0) {
			raster.createEl("p", {
				cls: "sms-leer",
				text: "Für diesen Tag sind keine Tracks eingetragen.",
			});
			return;
		}

		raster.style.gridTemplateColumns = `72px repeat(${tracks.length}, minmax(200px, 1fr))`;

		raster.createDiv({ cls: "sms-raster-ecke", text: "ZEIT" });
		for (const track of tracks) {
			const kopf = raster.createDiv({ cls: "sms-trackkopf" });
			kopf.createSpan({ cls: "sms-trackname", text: track.name });
			const ort = [track.raum, track.kapazitaet ? `${track.kapazitaet} Plätze` : undefined]
				.filter((teil): teil is string => !!teil)
				.join(" · ");
			if (ort) kopf.createSpan({ cls: "sms-trackraum", text: ort });
		}

		for (const block of tag.bloecke) {
			// Ein Fixblock hat keine Slots: Pause, Registrierung, Abendprogramm.
			if (block.fix) {
				raster.createDiv({ cls: "sms-zeit" });
				const band = raster.createDiv({ cls: "sms-fixblock" });
				band.style.gridColumn = `span ${tracks.length}`;
				band.setText(`${block.fix} · ${zeitspanne(block)}`);
				continue;
			}

			const zeit = raster.createDiv({ cls: "sms-zeit" });
			zeit.createDiv({ text: block.von ?? "" });
			zeit.createDiv({ cls: "sms-zeit-bis", text: block.bis ?? "" });

			// Ein plenarer Block belegt alle Tracks — ein Slot über die ganze Zeile.
			if (block.plenar) {
				const beitrag = beitraege.find((b) => b.block === block.id);
				const zelle = this.slotZeichnen(raster, konferenz, block, undefined, beitrag, engagements);
				zelle.style.gridColumn = `span ${tracks.length}`;
				zelle.addClass("sms-plenar");
				continue;
			}

			for (const track of tracks) {
				if (block.nur.length > 0 && !block.nur.includes(track.id)) {
					raster.createDiv({ cls: "sms-slot-entfaellt" });
					continue;
				}
				const beitrag = beitraege.find((b) => b.block === block.id && b.track === track.id);
				this.slotZeichnen(raster, konferenz, block, track.id, beitrag, engagements);
			}
		}
	}

	private slotZeichnen(
		raster: HTMLElement,
		konferenz: Konferenz,
		block: Block,
		trackId: string | undefined,
		beitrag: Beitrag | undefined,
		engagements: Map<string, Engagement>,
	): HTMLElement {
		if (!beitrag) {
			const leer = raster.createDiv({ cls: "sms-slot sms-slot-leer" });
			leer.createSpan({ text: "frei" });
			this.alsZiel(leer, block.id, trackId, undefined);
			return leer;
		}

		const speaker = beitrag.speaker[0];
		const engagement = speaker ? engagements.get(speaker) : undefined;
		const zustand = slotZustand(beitrag, engagement);

		const zelle = raster.createDiv({ cls: `sms-slot sms-slot-${zustand}` });
		zelle.addEventListener("click", () => this.notizOeffnen(beitrag.datei));
		this.alsZiehbar(zelle, beitrag);
		this.alsZiel(zelle, block.id, trackId, beitrag);

		zelle.createDiv({
			cls: beitrag.titel ? "sms-slot-titel" : "sms-slot-titel is-offen",
			text: beitrag.titel ?? (speaker ?? "Slot ohne Thema und Speaker"),
		});
		zelle.createDiv({
			cls: speaker ? "sms-slot-speaker" : "sms-slot-speaker is-offen",
			text: speaker ?? "Speaker noch offen",
		});

		const fuss = zelle.createDiv({ cls: "sms-slot-fuss" });
		if (block.plenar) fuss.createSpan({ cls: "sms-abzeichen", text: "plenar" });
		if (beitrag.format) {
			fuss.createSpan({ cls: "sms-abzeichen", text: FORMAT_TITEL[beitrag.format] ?? beitrag.format });
		}
		if (engagement) {
			fuss.createSpan({
				cls: `sms-abzeichen sms-abzeichen-${engagement.status}`,
				text: FUNNEL_TITEL[engagement.status] ?? engagement.status,
			});
		}
		if (!beitrag.titel && speaker) fuss.createSpan({ cls: "sms-abzeichen", text: "Thema offen" });

		// Raum und Kapazität kaskadieren; genannt wird nur die Abweichung.
		const ort = raumFuer(konferenz, block.id, trackId);
		if (ort.abweichend && ort.raum) {
			zelle.createDiv({ cls: "sms-slot-hinweis", text: `Raum: ${ort.raum}` });
		}
		if (
			beitrag.maxTeilnehmer !== undefined &&
			ort.kapazitaet !== undefined &&
			beitrag.maxTeilnehmer > ort.kapazitaet
		) {
			zelle.createDiv({
				cls: "sms-slot-hinweis sms-hinweis-rot",
				text: `⚠ für ${beitrag.maxTeilnehmer} angelegt, Raum fasst ${ort.kapazitaet}`,
			});
		}

		return zelle;
	}

	private poolZeichnen(
		eltern: HTMLElement,
		konferenz: Konferenz,
		beitraege: Beitrag[],
		engagements: Map<string, Engagement>,
	): void {
		const pool = eltern.createDiv({ cls: "sms-pool" });
		this.alsZiel(pool, undefined, undefined, undefined);

		const ohneOrt = beitraege.filter(
			(beitrag) => !beitrag.block || heimatlos(beitrag, konferenz),
		);

		const kopf = pool.createDiv({ cls: "sms-spalte-kopf" });
		kopf.createSpan({ cls: "sms-spalte-titel", text: "Pool" });
		kopf.createSpan({
			cls: "sms-spalte-zahl",
			text: `${ohneOrt.length} ohne Ort`,
		});

		for (const beitrag of ohneOrt) {
			const verwaist = heimatlos(beitrag, konferenz);
			const karte = pool.createDiv({
				cls: verwaist ? "sms-karte sms-poolkarte is-heimatlos" : "sms-karte sms-poolkarte",
			});
			karte.addEventListener("click", () => this.notizOeffnen(beitrag.datei));
			this.alsZiehbar(karte, beitrag);

			karte.createDiv({
				cls: beitrag.titel ? "sms-slot-titel" : "sms-slot-titel is-offen",
				text: beitrag.titel ?? "Thema noch offen",
			});
			karte.createDiv({
				cls: beitrag.speaker[0] ? "sms-slot-speaker" : "sms-slot-speaker is-offen",
				text: beitrag.speaker[0] ?? "Speaker noch offen",
			});

			const fuss = karte.createDiv({ cls: "sms-slot-fuss" });
			if (verwaist) {
				fuss.createSpan({ cls: "sms-abzeichen sms-abzeichen-gestrichen", text: "⚠ heimatlos" });
				fuss.createSpan({ cls: "sms-slot-hinweis", text: `Block ${beitrag.block} entfallen` });
			} else {
				fuss.createSpan({ cls: "sms-abzeichen", text: "noch nicht platziert" });
			}
		}

		// Kandidaten, für die es noch gar keinen Beitrag gibt.
		const mitBeitrag = new Set(beitraege.flatMap((beitrag) => beitrag.speaker));
		const ohneBeitrag = [...engagements.values()].filter(
			(engagement) =>
				engagement.status !== "gestrichen" && !mitBeitrag.has(engagement.speaker),
		);

		if (ohneBeitrag.length === 0) return;

		const zweiter = pool.createDiv({ cls: "sms-spalte-kopf" });
		zweiter.createSpan({ cls: "sms-spalte-titel", text: "Kandidaten ohne Beitrag" });
		zweiter.createSpan({ cls: "sms-spalte-zahl", text: String(ohneBeitrag.length) });

		for (const engagement of ohneBeitrag) {
			const zeile = pool.createDiv({ cls: "sms-kandidat" });
			zeile.addEventListener("click", () => this.notizOeffnen(engagement.datei));
			zeile.createSpan({ text: engagement.speaker });
			zeile.createSpan({
				cls: `sms-abzeichen sms-abzeichen-${engagement.status}`,
				text: FUNNEL_TITEL[engagement.status] ?? engagement.status,
			});
		}
	}

	// -------------------------------------------------------------- Ziehen

	private alsZiehbar(element: HTMLElement, beitrag: Beitrag): void {
		element.draggable = true;
		element.addClass("is-ziehbar");

		element.addEventListener("dragstart", (ereignis) => {
			this.gezogen = beitrag;
			element.addClass("is-zieht");
			// Ohne Nutzlast startet in Electron kein Zug.
			ereignis.dataTransfer?.setData("text/plain", beitrag.datei.path);
			if (ereignis.dataTransfer) ereignis.dataTransfer.effectAllowed = "move";
		});

		element.addEventListener("dragend", () => {
			element.removeClass("is-zieht");
			this.gezogen = null;
		});
	}

	/**
	 * Macht eine Zelle zum Ziel. Ohne Block ist das Ziel der Pool — dort landet
	 * ein Beitrag, dessen Ort wieder offen sein soll.
	 */
	private alsZiel(
		element: HTMLElement,
		block: string | undefined,
		track: string | undefined,
		belegtVon: Beitrag | undefined,
	): void {
		element.addEventListener("dragover", (ereignis) => {
			if (!this.gezogen || this.gezogen === belegtVon) return;
			ereignis.preventDefault();
			element.addClass("is-ziel");
		});

		element.addEventListener("dragleave", (ereignis) => {
			if (element.contains(ereignis.relatedTarget as Node)) return;
			element.removeClass("is-ziel");
		});

		element.addEventListener("drop", (ereignis) => {
			if (!this.gezogen || this.gezogen === belegtVon) return;
			ereignis.preventDefault();
			ereignis.stopPropagation();
			element.removeClass("is-ziel");
			void this.platzieren(block, track, belegtVon);
		});
	}

	/**
	 * Schreibt den neuen Ort. Ist das Ziel belegt, tauschen die beiden ihre
	 * Plätze, statt den Slot doppelt zu belegen — der Beitrag, der weichen
	 * muss, landet dort, wo der gezogene herkam, notfalls im Pool. So geht
	 * nichts verloren, und ein Zug lässt sich rückgängig machen, indem man ihn
	 * wiederholt.
	 */
	private async platzieren(
		block: string | undefined,
		track: string | undefined,
		belegtVon: Beitrag | undefined,
	): Promise<void> {
		const beitrag = this.gezogen;
		this.gezogen = null;
		if (!beitrag) return;
		if (beitrag.block === block && beitrag.track === track) return;

		const aenderungen: { datei: TFile; block?: string; track?: string }[] = [
			{ datei: beitrag.datei, block, track },
		];
		if (belegtVon) {
			aenderungen.push({
				datei: belegtVon.datei,
				block: beitrag.block,
				track: beitrag.track,
			});
		}

		try {
			await this.schreiber.beitraegePlatzieren(aenderungen);
		} catch (fehler) {
			new Notice(`Der Beitrag ließ sich nicht verschieben: ${String(fehler)}`);
		}
	}

	// ---------------------------------------------------------------- Zählen

	/** Löcher sind die Slots dieses Tages, in denen nichts steht. */
	private loecher(konferenz: Konferenz, tag: Tag, beitraege: Beitrag[]): number {
		const tracks = konferenz.tracks.filter((track) => tag.tracks.includes(track.id));

		let offen = 0;
		for (const block of tag.bloecke) {
			if (block.fix) continue;

			if (block.plenar) {
				if (!beitraege.some((beitrag) => beitrag.block === block.id)) offen++;
				continue;
			}

			for (const track of tracks) {
				if (block.nur.length > 0 && !block.nur.includes(track.id)) continue;
				const belegt = beitraege.some(
					(beitrag) => beitrag.block === block.id && beitrag.track === track.id,
				);
				if (!belegt) offen++;
			}
		}
		return offen;
	}
}

/**
 * Der Fortschritt eines Slots ist das Minimum aus eigener Füllung und dem
 * Status des zugehörigen Engagements.
 */
function slotZustand(beitrag: Beitrag, engagement: Engagement | undefined): Zustand {
	const hatThema = !!beitrag.titel;
	const hatSpeaker = beitrag.speaker.length > 0;

	if (!hatThema || !hatSpeaker) return "halb";
	if (engagement && ZUGESAGT_UND_WEITER.includes(engagement.status)) return "gruen";
	return "verdacht";
}

/** Wie in der Statustafel: kein Block heißt Pool, ein verschwundener heißt heimatlos. */
function heimatlos(beitrag: Beitrag, konferenz: Konferenz): boolean {
	if (!beitrag.block) return false;

	const tag = konferenz.tage.find((t) => t.bloecke.some((block) => block.id === beitrag.block));
	if (!tag) return true;
	if (!beitrag.track) return false;

	if (!konferenz.tracks.some((track) => track.id === beitrag.track)) return true;
	return tag.tracks.length > 0 && !tag.tracks.includes(beitrag.track);
}

function zeitspanne(block: Block): string {
	if (block.von && block.bis) return `${block.von} – ${block.bis}`;
	return block.von ?? block.bis ?? "";
}

/** Aus `2026-11-04` wird `Mi · 4. Nov`. */
function tagesTitel(tag: Tag, index: number): string {
	if (!tag.datum) return `Tag ${index + 1}`;

	const treffer = /^(\d{4})-(\d{2})-(\d{2})/.exec(tag.datum);
	if (!treffer) return tag.datum;

	const jahr = Number(treffer[1]);
	const monat = Number(treffer[2]);
	const tagImMonat = Number(treffer[3]);

	const wochentag = WOCHENTAGE[new Date(jahr, monat - 1, tagImMonat).getDay()];
	return `${wochentag} · ${tagImMonat}. ${MONATE_KURZ[monat - 1]}`;
}
