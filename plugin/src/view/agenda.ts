import { Notice, type App, type TFile } from "obsidian";
import type { Datenzugriff } from "../daten/lesen";
import { istPlatzhalterName, type Datenschreiber } from "../daten/schreiben";
import { BestaetigenModal, BlockModal, TagModal, TrackModal } from "./rasterModale";
import {
	FORMAT_TITEL,
	FUNNEL_TITEL,
	ZUGESAGT_UND_WEITER,
	istArchiv,
	raumFuer,
	type Beitrag,
	type Block,
	type Engagement,
	type Konferenz,
	type Tag,
	type Track,
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
/** Was gerade am Mauszeiger hängt — ein Beitrag zieht um, ein Kandidat entsteht. */
type Zug =
	| { art: "beitrag"; beitrag: Beitrag }
	| { art: "kandidat"; engagement: Engagement };

/** Der Platz, auf den gezogen werden kann. Ohne Angabe ist es der Pool. */
interface Ziel {
	tag: Tag;
	block: Block;
	track?: Track;
}

export class Agenda {
	private tagIndex = 0;
	private gezogen: Zug | null = null;
	private konferenz: Konferenz | undefined;
	/** Bei gelaufenen und abgesagten Konferenzen ist das Programm nur noch Archiv. */
	private archiv = false;

	constructor(
		private app: App,
		private daten: Datenzugriff,
		private schreiber: Datenschreiber,
		private notizOeffnen: (datei: TFile) => void,
	) {}

	async zeichnen(buehne: HTMLElement, konferenz: Konferenz | undefined): Promise<void> {
		buehne.empty();
		buehne.addClass("sms-agenda");
		this.konferenz = konferenz;
		this.archiv = istArchiv(konferenz);

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
		if (this.archiv) {
			marken.createSpan({
				cls: "sms-marke sms-marke-archiv",
				text: konferenz.status === "abgesagt" ? "abgesagt · Archiv" : "gelaufen · Archiv",
			});
		}
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

		if (this.archiv) return;

		// Das Raster gehört dem Plugin — hier wird es gebaut.
		const werkzeuge = reiter.createDiv({ cls: "sms-werkzeuge" });
		this.werkzeug(werkzeuge, "＋ Tag", () => void this.tagHinzufuegen());
		if (tag) {
			this.werkzeug(werkzeuge, "＋ Track", () => void this.trackHinzufuegen());
			this.werkzeug(werkzeuge, "＋ Block", () => void this.blockHinzufuegen());
			this.werkzeug(werkzeuge, "Tag löschen", () => void this.tagLoeschen());
		}
	}

	private werkzeug(eltern: HTMLElement, text: string, tun: () => void): void {
		const knopf = eltern.createEl("button", { cls: "sms-werkzeug", text });
		knopf.addEventListener("click", tun);
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

			const zeile = kopf.createDiv({ cls: "sms-trackzeile" });
			zeile.createSpan({ cls: "sms-trackname", text: track.name });
			if (!this.archiv) {
				this.werkzeug(zeile, "✎", () => void this.trackAendern(track));
				this.werkzeug(zeile, "✕", () => void this.trackLoeschen(track));
			}

			const ort = [track.raum, track.kapazitaet ? `${track.kapazitaet} Plätze` : undefined]
				.filter((teil): teil is string => !!teil)
				.join(" · ");
			if (ort) kopf.createSpan({ cls: "sms-trackraum", text: ort });
		}

		for (const block of tag.bloecke) {
			// Ein Fixblock hat keine Slots: Pause, Registrierung, Abendprogramm.
			if (block.fix) {
				this.zeitZeichnen(raster, block);
				const band = raster.createDiv({ cls: "sms-fixblock" });
				band.style.gridColumn = `span ${tracks.length}`;
				band.setText(`${block.fix} · ${zeitspanne(block)}`);
				continue;
			}

			this.zeitZeichnen(raster, block);

			// Ein plenarer Block belegt alle Tracks — ein Slot über die ganze Zeile.
			if (block.plenar) {
				const beitrag = beitraege.find((b) => b.block === block.id);
				const zelle = this.slotZeichnen(
					raster,
					konferenz,
					{ tag, block },
					beitrag,
					engagements,
				);
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
				this.slotZeichnen(raster, konferenz, { tag, block, track }, beitrag, engagements);
			}
		}
	}

	private slotZeichnen(
		raster: HTMLElement,
		konferenz: Konferenz,
		ziel: Ziel,
		beitrag: Beitrag | undefined,
		engagements: Map<string, Engagement>,
	): HTMLElement {
		const block = ziel.block;
		const trackId = ziel.track?.id;

		if (!beitrag) {
			const leer = raster.createDiv({ cls: "sms-slot sms-slot-leer" });
			leer.createSpan({ text: "frei" });
			this.alsZiel(leer, ziel, undefined);
			return leer;
		}

		const speaker = beitrag.speaker[0];
		const engagement = speaker ? engagements.get(speaker) : undefined;
		const zustand = slotZustand(beitrag, engagement);

		const zelle = raster.createDiv({ cls: `sms-slot sms-slot-${zustand}` });
		zelle.addEventListener("click", () => this.notizOeffnen(beitrag.datei));
		this.alsZiehbar(zelle, { art: "beitrag", beitrag });
		this.alsZiel(zelle, ziel, beitrag);

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

		this.umbenennenAnbieten(zelle, beitrag);

		return zelle;
	}

	private poolZeichnen(
		eltern: HTMLElement,
		konferenz: Konferenz,
		beitraege: Beitrag[],
		engagements: Map<string, Engagement>,
	): void {
		const pool = eltern.createDiv({ cls: "sms-pool" });
		this.alsZiel(pool, undefined, undefined);

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
			this.alsZiehbar(karte, { art: "beitrag", beitrag });

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

			this.umbenennenAnbieten(karte, beitrag);
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
			this.alsZiehbar(zeile, { art: "kandidat", engagement });
			zeile.createSpan({ text: engagement.speaker });
			zeile.createSpan({
				cls: `sms-abzeichen sms-abzeichen-${engagement.status}`,
				text: FUNNEL_TITEL[engagement.status] ?? engagement.status,
			});
		}

		if (!this.archiv) {
			pool.createDiv({
				cls: "sms-poolnotiz",
				text: "Zieht man einen Kandidaten in einen freien Slot, entsteht sein Beitrag.",
			});
		}
	}

	private zeitZeichnen(raster: HTMLElement, block: Block): void {
		const zeit = raster.createDiv({ cls: "sms-zeit" });
		zeit.createDiv({ text: block.von ?? "" });
		zeit.createDiv({ cls: "sms-zeit-bis", text: block.bis ?? "" });

		if (this.archiv) return;
		const werkzeuge = zeit.createDiv({ cls: "sms-werkzeuge" });
		this.werkzeug(werkzeuge, "✎", () => void this.blockAendern(block));
		this.werkzeug(werkzeuge, "✕", () => void this.blockLoeschen(block));
	}

	// -------------------------------------------------------- Raster ändern

	/** Der nächste freie Bezeichner der Form `b7` oder `t3`. */
	private naechsteId(praefix: string, vergeben: string[]): string {
		let zahl = 1;
		while (vergeben.includes(`${praefix}${zahl}`)) zahl++;
		return `${praefix}${zahl}`;
	}

	private async rasterSchreiben(tracks: Track[], tage: Tag[]): Promise<void> {
		if (!this.konferenz) return;
		try {
			await this.schreiber.rasterSchreiben(this.konferenz, tracks, tage);
		} catch (fehler) {
			new Notice(`Das Raster ließ sich nicht schreiben: ${String(fehler)}`);
		}
	}

	private async tagHinzufuegen(): Promise<void> {
		const konferenz = this.konferenz;
		if (!konferenz) return;

		const datum = await new TagModal(this.app).frage();
		if (!datum) return;

		const vergeben = konferenz.tage.flatMap((tag) => tag.bloecke.map((block) => block.id));
		const neu: Tag = {
			datum,
			tracks: konferenz.tracks.map((track) => track.id),
			bloecke: [],
		};
		// Ein Tag ohne Blöcke wäre eine leere Seite — drei sind ein Anfang.
		for (const zeiten of [
			{ von: "09:00", bis: "09:45" },
			{ von: "09:45", bis: "10:00", fix: "Pause" },
			{ von: "10:00", bis: "10:45" },
		]) {
			const id = this.naechsteId("b", vergeben);
			vergeben.push(id);
			neu.bloecke.push({ id, ...zeiten, plenar: false, nur: [] });
		}

		const tage = [...konferenz.tage, neu].sort((a, b) => (a.datum ?? "").localeCompare(b.datum ?? ""));
		this.tagIndex = tage.indexOf(neu);
		await this.rasterSchreiben(konferenz.tracks, tage);
	}

	private async tagLoeschen(): Promise<void> {
		const konferenz = this.konferenz;
		const tag = konferenz?.tage[this.tagIndex];
		if (!konferenz || !tag) return;

		const betroffene = this.beitraegeIn(tag.bloecke.map((block) => block.id));
		const ja = await new BestaetigenModal(
			this.app,
			"Tag löschen?",
			betroffene.length === 0
				? "Der Tag hat keine Beiträge. Seine Blöcke verschwinden mit ihm."
				: `${anzahlBeitraege(betroffene.length)} an diesem Tag verlieren ihren Platz und landen im Pool.`,
			"Löschen",
		).frage();
		if (!ja) return;

		await this.inDenPool(betroffene);
		const tage = konferenz.tage.filter((eigener) => eigener !== tag);
		this.tagIndex = Math.max(0, this.tagIndex - 1);
		await this.rasterSchreiben(konferenz.tracks, tage);
	}

	private async trackHinzufuegen(): Promise<void> {
		const konferenz = this.konferenz;
		const tag = konferenz?.tage[this.tagIndex];
		if (!konferenz || !tag) return;

		const angaben = await new TrackModal(this.app).frage();
		if (!angaben) return;

		const id = this.naechsteId(
			"t",
			konferenz.tracks.map((track) => track.id),
		);
		const tracks = [...konferenz.tracks, { id, ...angaben }];
		// Ein neuer Track gehört zunächst dem Tag, an dem er entstand.
		const tage = konferenz.tage.map((eigener) =>
			eigener === tag ? { ...eigener, tracks: [...eigener.tracks, id] } : eigener,
		);
		await this.rasterSchreiben(tracks, tage);
	}

	private async trackAendern(track: Track): Promise<void> {
		const konferenz = this.konferenz;
		if (!konferenz) return;

		const angaben = await new TrackModal(this.app, track).frage();
		if (!angaben) return;

		const tracks = konferenz.tracks.map((eigener) =>
			eigener.id === track.id ? { id: track.id, ...angaben } : eigener,
		);
		await this.rasterSchreiben(tracks, konferenz.tage);
	}

	private async trackLoeschen(track: Track): Promise<void> {
		const konferenz = this.konferenz;
		if (!konferenz) return;

		const betroffene = this.daten
			.beitraege()
			.filter((beitrag) => beitrag.konferenz === konferenz.name && beitrag.track === track.id);

		const ja = await new BestaetigenModal(
			this.app,
			`Track „${track.name}“ löschen?`,
			betroffene.length === 0
				? "Der Track wird aus allen Tagen entfernt."
				: `Er wird aus allen Tagen entfernt. ${anzahlBeitraege(betroffene.length)} verlieren ihren Platz und landen im Pool.`,
			"Löschen",
		).frage();
		if (!ja) return;

		await this.inDenPool(betroffene);
		const tracks = konferenz.tracks.filter((eigener) => eigener.id !== track.id);
		const tage = konferenz.tage.map((tag) => ({
			...tag,
			tracks: tag.tracks.filter((id) => id !== track.id),
		}));
		await this.rasterSchreiben(tracks, tage);
	}

	private async blockHinzufuegen(): Promise<void> {
		const konferenz = this.konferenz;
		const tag = konferenz?.tage[this.tagIndex];
		if (!konferenz || !tag) return;

		const angaben = await new BlockModal(this.app).frage();
		if (!angaben) return;

		const id = this.naechsteId(
			"b",
			konferenz.tage.flatMap((eigener) => eigener.bloecke.map((block) => block.id)),
		);
		const bloecke = [...tag.bloecke, { id, ...angaben }].sort((a, b) =>
			(a.von ?? "").localeCompare(b.von ?? ""),
		);
		const tage = konferenz.tage.map((eigener) =>
			eigener === tag ? { ...eigener, bloecke } : eigener,
		);
		await this.rasterSchreiben(konferenz.tracks, tage);
	}

	private async blockAendern(block: Block): Promise<void> {
		const konferenz = this.konferenz;
		const tag = konferenz?.tage[this.tagIndex];
		if (!konferenz || !tag) return;

		const angaben = await new BlockModal(this.app, block).frage();
		if (!angaben) return;

		// Die ID bleibt: An ihr hängen die Beiträge. Nur die Zeit ist ein Attribut.
		const bloecke = tag.bloecke
			.map((eigener) => (eigener.id === block.id ? { id: block.id, ...angaben } : eigener))
			.sort((a, b) => (a.von ?? "").localeCompare(b.von ?? ""));
		const tage = konferenz.tage.map((eigener) =>
			eigener === tag ? { ...eigener, bloecke } : eigener,
		);
		await this.rasterSchreiben(konferenz.tracks, tage);
	}

	private async blockLoeschen(block: Block): Promise<void> {
		const konferenz = this.konferenz;
		const tag = konferenz?.tage[this.tagIndex];
		if (!konferenz || !tag) return;

		const betroffene = this.beitraegeIn([block.id]);
		const ja = await new BestaetigenModal(
			this.app,
			"Block löschen?",
			betroffene.length === 0
				? `Der Block ${zeitspanne(block)} wird aus diesem Tag entfernt.`
				: `${anzahlBeitraege(betroffene.length)} in diesem Block verlieren ihren Platz und landen im Pool.`,
			"Löschen",
		).frage();
		if (!ja) return;

		await this.inDenPool(betroffene);
		const bloecke = tag.bloecke.filter((eigener) => eigener.id !== block.id);
		const tage = konferenz.tage.map((eigener) =>
			eigener === tag ? { ...eigener, bloecke } : eigener,
		);
		await this.rasterSchreiben(konferenz.tracks, tage);
	}

	private beitraegeIn(blockIds: string[]): Beitrag[] {
		const konferenz = this.konferenz;
		if (!konferenz) return [];
		return this.daten
			.beitraege()
			.filter(
				(beitrag) =>
					beitrag.konferenz === konferenz.name &&
					beitrag.block !== undefined &&
					blockIds.includes(beitrag.block),
			);
	}

	/** Wer seinen Platz verliert, wird nicht heimatlos, sondern liegt im Pool. */
	private async inDenPool(beitraege: Beitrag[]): Promise<void> {
		if (beitraege.length === 0) return;
		await this.schreiber.beitraegePlatzieren(
			beitraege.map((beitrag) => ({ datei: beitrag.datei })),
		);
	}

	// -------------------------------------------------------------- Ziehen

	private alsZiehbar(element: HTMLElement, zug: Zug): void {
		if (this.archiv) return;

		element.draggable = true;
		element.addClass("is-ziehbar");

		const datei = zug.art === "beitrag" ? zug.beitrag.datei : zug.engagement.datei;

		element.addEventListener("dragstart", (ereignis) => {
			this.gezogen = zug;
			element.addClass("is-zieht");
			// Ohne Nutzlast startet in Electron kein Zug.
			ereignis.dataTransfer?.setData("text/plain", datei.path);
			if (ereignis.dataTransfer) ereignis.dataTransfer.effectAllowed = "move";
		});

		element.addEventListener("dragend", () => {
			element.removeClass("is-zieht");
			this.gezogen = null;
		});
	}

	/**
	 * Macht eine Zelle zum Ziel. Ohne `ziel` ist es der Pool — dort landet ein
	 * Beitrag, dessen Ort wieder offen sein soll. Ein Kandidat darf nur in
	 * einen freien Slot: Aus ihm entsteht ein Beitrag, und der braucht Platz.
	 */
	private alsZiel(element: HTMLElement, ziel: Ziel | undefined, belegtVon: Beitrag | undefined): void {
		const erlaubt = (): boolean => {
			if (this.archiv) return false;
			const zug = this.gezogen;
			if (!zug) return false;
			if (zug.art === "beitrag") return zug.beitrag !== belegtVon;
			return ziel !== undefined && belegtVon === undefined;
		};

		element.addEventListener("dragover", (ereignis) => {
			if (!erlaubt()) return;
			ereignis.preventDefault();
			element.addClass("is-ziel");
		});

		element.addEventListener("dragleave", (ereignis) => {
			if (element.contains(ereignis.relatedTarget as Node)) return;
			element.removeClass("is-ziel");
		});

		element.addEventListener("drop", (ereignis) => {
			const zug = this.gezogen;
			if (!erlaubt() || !zug) return;
			ereignis.preventDefault();
			ereignis.stopPropagation();
			element.removeClass("is-ziel");

			if (zug.art === "beitrag") void this.platzieren(ziel, belegtVon);
			else if (ziel) void this.kandidatEinplanen(zug.engagement, ziel);
		});
	}

	/** Aus einem Kandidaten wird ein Beitrag — titellos, der Speaker steht ja. */
	private async kandidatEinplanen(engagement: Engagement, ziel: Ziel): Promise<void> {
		const konferenz = this.konferenz;
		this.gezogen = null;
		if (!konferenz) return;

		try {
			const datei = await this.schreiber.beitragAnlegen({
				konferenz,
				speaker: engagement.speaker,
				tag: ziel.tag,
				block: ziel.block,
				track: ziel.track,
			});
			// Der Titel fehlt noch — die Notiz ist der Ort, an dem er entsteht.
			this.notizOeffnen(datei);
		} catch (fehler) {
			new Notice(`Der Beitrag ließ sich nicht anlegen: ${String(fehler)}`);
		}
	}

	/**
	 * Schreibt den neuen Ort. Ist das Ziel belegt, tauschen die beiden ihre
	 * Plätze, statt den Slot doppelt zu belegen — der Beitrag, der weichen
	 * muss, landet dort, wo der gezogene herkam, notfalls im Pool. So geht
	 * nichts verloren, und ein Zug lässt sich rückgängig machen, indem man ihn
	 * wiederholt.
	 */
	private async platzieren(ziel: Ziel | undefined, belegtVon: Beitrag | undefined): Promise<void> {
		const zug = this.gezogen;
		this.gezogen = null;
		if (zug?.art !== "beitrag") return;

		const beitrag = zug.beitrag;
		const block = ziel?.block.id;
		const track = ziel?.track?.id;
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
			// Ein Platzhaltername nennt den Slot; zieht der Beitrag um, zieht der
			// Name mit. Das ist eine Aktion des Plugins, kein Tippen — deshalb
			// darf es hier automatisch geschehen.
			await this.platzhalterNachziehen(beitrag, ziel);
			if (belegtVon) {
				await this.platzhalterNachziehen(
					belegtVon,
					this.slotOrt(beitrag.block, beitrag.track),
				);
			}
		} catch (fehler) {
			new Notice(`Der Beitrag ließ sich nicht verschieben: ${String(fehler)}`);
		}
	}

	private async platzhalterNachziehen(
		beitrag: Beitrag,
		ziel: Ziel | undefined,
	): Promise<void> {
		const konferenz = this.konferenz;
		if (!konferenz || !ziel) return;
		if (beitrag.titel) return;
		if (!istPlatzhalterName(beitrag.datei.basename, konferenz.name)) return;

		await this.schreiber.platzhalterNachziehen(beitrag.datei, {
			konferenz,
			tag: ziel.tag,
			block: ziel.block,
			track: ziel.track,
		});
	}

	/** Sucht Tag, Block und Track zu einem Paar aus IDs. */
	private slotOrt(blockId?: string, trackId?: string): Ziel | undefined {
		if (!this.konferenz || !blockId) return undefined;

		for (const tag of this.konferenz.tage) {
			const block = tag.bloecke.find((b) => b.id === blockId);
			if (!block) continue;
			const track = this.konferenz.tracks.find((t) => t.id === trackId);
			return { tag, block, track };
		}
		return undefined;
	}

	/**
	 * Trägt die Notiz noch ihren Platzhalternamen, obwohl der Titel dasteht,
	 * bietet die Karte das Umbenennen an — auf Klick, nicht von selbst. Beim
	 * Tippen im Property-Editor würde ein Automatismus die Datei bei jedem
	 * Buchstaben umbenennen.
	 */
	private umbenennenAnbieten(karte: HTMLElement, beitrag: Beitrag): void {
		const konferenz = this.konferenz;
		if (this.archiv || !konferenz || !beitrag.titel) return;
		if (!istPlatzhalterName(beitrag.datei.basename, konferenz.name)) return;

		const zeile = karte.createDiv({ cls: "sms-slot-hinweis" });
		zeile.createSpan({ text: "Notiz heißt noch nach ihrem Platz · " });

		const knopf = zeile.createSpan({ cls: "sms-umbenennen", text: "umbenennen" });
		knopf.addEventListener("click", (ereignis) => {
			// Sonst öffnet der Klick zusätzlich die Notiz.
			ereignis.stopPropagation();
			void this.umbenennen(beitrag);
		});
	}

	/** Der Platzhalter hat ausgedient, sobald ein Titel dasteht. */
	private async umbenennen(beitrag: Beitrag): Promise<void> {
		const konferenz = this.konferenz;
		if (!konferenz || !beitrag.titel) return;

		try {
			await this.schreiber.beitragUmbenennen(beitrag.datei, konferenz, beitrag.titel);
		} catch (fehler) {
			new Notice(`Die Notiz ließ sich nicht umbenennen: ${String(fehler)}`);
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

function anzahlBeitraege(wert: number): string {
	return wert === 1 ? "Ein Beitrag" : `${wert} Beiträge`;
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
