import { Notice, type App, type TFile } from "obsidian";
import type { Datenzugriff } from "../daten/lesen";
import { istPlatzhalterName } from "../daten/namen";
import type { Datenschreiber } from "../daten/schreiben";
import { BestaetigenModal, BlockModal, TagModal, TrackModal } from "./rasterModale";
import {
	dauerImRaster,
	doppeltBelegte,
	erwartetBeitrag,
	frueherGehalten,
	hatRolle,
	heimatlos,
	minuten,
	nachZeit,
	parallelStehende,
	plaetzeEinesBlocks,
	plaetzeEinesSlots,
	slotZustand,
	ueberschneidungen,
	verschoben,
	zeitgleich,
	zielBloecke,
	type Zustand,
} from "../daten/projektion";
import {
	FORMAT_TITEL,
	FUNNEL_TITEL,
	ZUGESAGT_UND_WEITER,
	istArchiv,
	raumFuer,
	slotsEinesTages,
	type Beitrag,
	type Block,
	type Engagement,
	type Konferenz,
	type Tag,
	type Track,
} from "../daten/modell";

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
	private alleBeitraege: Beitrag[] = [];
	private alleKonferenzen: Konferenz[] = [];

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

		// Alle Beiträge, nicht nur die dieser Konferenz: Beim Füllen eines Slots
		// soll dastehen, was der Speaker früher gehalten hat.
		const alleBeitraege = this.daten.beitraege();
		this.alleBeitraege = alleBeitraege;
		this.alleKonferenzen = this.daten.konferenzen();
		const beitraege = alleBeitraege.filter((beitrag) => beitrag.konferenz === konferenz.name);
		const engagements = new Map(
			this.daten
				.engagements()
				.filter((engagement) => engagement.konferenz === konferenz.name)
				.map((engagement) => [engagement.speaker, engagement]),
		);

		if (this.tagIndex >= konferenz.tage.length) this.tagIndex = 0;
		const tag = konferenz.tage[this.tagIndex];

		this.kopfZeichnen(buehne, konferenz, tag, beitraege);
		this.moderationZeichnen(buehne, [...engagements.values()]);

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
		const imPool = beitraege.filter((beitrag) => beitrag.bloecke.length === 0).length;
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

		const strittig = tag ? ueberschneidungen(tag) : 0;
		if (strittig > 0) {
			marken.createSpan({
				cls: "sms-marke sms-marke-rot",
				text: strittig === 1 ? "1 Überschneidung" : `${strittig} Überschneidungen`,
			});
		}

		const doppelt = tag ? doppeltBelegte(tag, beitraege) : 0;
		if (doppelt > 0) {
			marken.createSpan({
				cls: "sms-marke sms-marke-rot",
				text: doppelt === 1 ? "1 Slot doppelt belegt" : `${doppelt} Slots doppelt belegt`,
			});
		}

		const parallele = tag ? parallelStehende(tag, beitraege) : 0;
		if (parallele > 0) {
			marken.createSpan({
				cls: "sms-marke sms-marke-rot",
				text:
					parallele === 1 ? "1 Speaker zeitgleich zweimal" : `${parallele} Speaker zeitgleich zweimal`,
			});
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

	private werkzeug(eltern: HTMLElement, text: string, tun: () => void, titel?: string): void {
		const knopf = eltern.createEl("button", {
			cls: "sms-werkzeug",
			text,
			attr: titel ? { title: titel } : {},
		});
		knopf.addEventListener("click", (ereignis) => {
			// In einer Karte darf der Knopf nicht auch noch die Notiz öffnen.
			ereignis.stopPropagation();
			tun();
		});
	}

	/**
	 * Ein Band über dem Raster — dort, wo die durchgehende Moderation auch
	 * sachlich liegt: über allen Blöcken, ohne selbst einen Slot zu belegen.
	 * Als kleine Zeile im Kopf ging sie unter, neben dem Untertitel.
	 */
	private moderationZeichnen(buehne: HTMLElement, engagements: Engagement[]): void {
		const moderation = engagements
			.filter((engagement) => engagement.status !== "gestrichen" && hatRolle(engagement, "moderation"))
			.map((engagement) => engagement.speaker);
		if (moderation.length === 0) return;

		const band = buehne.createDiv({ cls: "sms-moderation" });
		band.createSpan({ cls: "sms-moderation-titel", text: "Moderation" });
		band.createSpan({ text: moderation.join(", ") });
		band.createSpan({
			cls: "sms-moderation-zusatz",
			text: "führt durch den Tag · belegt keinen Slot",
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

		// Nach Uhrzeit, nicht nach Reihenfolge im Frontmatter: Von Hand kann dort
		// alles stehen, und die Prüfung auf Lücken braucht die zeitliche Folge.
		const bloecke = nachZeit(tag.bloecke);

		// Erst die Zeilen festlegen, dann zeichnen: Ein Beitrag über mehrere
		// Blöcke muss wissen, über wie viele Zeilen er reicht — und dazwischen
		// können Lücken- und Überschneidungszeilen liegen.
		const zeilen: ({ art: "block"; block: Block } | { art: "zwischenraum"; spanne: number })[] = [];
		let vorherBis: string | undefined;
		for (const block of bloecke) {
			if (vorherBis && block.von) {
				const spanne = minuten(block.von) - minuten(vorherBis);
				if (spanne !== 0) zeilen.push({ art: "zwischenraum", spanne });
			}
			zeilen.push({ art: "block", block });
			vorherBis = block.bis ?? vorherBis;
		}

		/** Die Gitterzeile eines Blocks — Zeile 1 ist der Kopf. */
		const zeileVon = (blockId: string): number =>
			zeilen.findIndex((z) => z.art === "block" && z.block.id === blockId) + 2;

		zeilen.forEach((eintrag, index) => {
			const zeile = index + 2;

			if (eintrag.art === "zwischenraum") {
				this.zwischenraumZeichnen(raster, tracks.length, zeile, eintrag.spanne);
				return;
			}

			const block = eintrag.block;
			this.zeitZeichnen(raster, block, zeile, tag, beitraege);

			// Ein Fixblock hat keine Slots: Pause, Registrierung, Abendprogramm.
			if (block.fix) {
				const band = raster.createDiv({ cls: "sms-fixblock" });
				band.style.gridRow = String(zeile);
				band.style.gridColumn = `2 / span ${tracks.length}`;
				band.setText(`${block.fix} · ${zeitspanne(block)}`);
				return;
			}

			// Ein plenarer Block belegt alle Tracks — ein Slot über die ganze Zeile.
			if (block.plenar) {
				const passende = beitraege.filter((b) => b.bloecke.includes(block.id));
				const beitrag = passende[0];
				if (beitrag && !istErsterBlock(beitrag, block.id, bloecke)) return;

				const zelle = this.slotZeichnen(
					raster,
					konferenz,
					{ tag, block },
					beitrag,
					engagements,
					{ weitere: passende.length - 1, alle: beitraege },
				);
				zelle.style.gridRow = `${zeile} / span ${hoehe(beitrag, block, bloecke, zeileVon, zeile)}`;
				zelle.style.gridColumn = `2 / span ${tracks.length}`;
				zelle.addClass("sms-plenar");
				return;
			}

			tracks.forEach((track, spaltenIndex) => {
				const spalte = spaltenIndex + 2;

				if (block.nur.length > 0 && !block.nur.includes(track.id)) {
					const leer = raster.createDiv({ cls: "sms-slot-entfaellt" });
					leer.style.gridRow = String(zeile);
					leer.style.gridColumn = String(spalte);
					return;
				}

				// Ein Slot kann von Hand doppelt belegt worden sein; gezeichnet wird
				// der erste, gezählt werden alle.
				const passende = beitraege.filter(
					(b) => b.bloecke.includes(block.id) && b.track === track.id,
				);
				const beitrag = passende[0];
				// Wer über mehrere Blöcke läuft, wird nur einmal gezeichnet.
				if (beitrag && !istErsterBlock(beitrag, block.id, bloecke)) return;

				const zelle = this.slotZeichnen(
					raster,
					konferenz,
					{ tag, block, track },
					beitrag,
					engagements,
					{ weitere: passende.length - 1, alle: beitraege },
				);
				zelle.style.gridRow = `${zeile} / span ${hoehe(beitrag, block, bloecke, zeileVon, zeile)}`;
				zelle.style.gridColumn = String(spalte);
			});
		});
	}

	private slotZeichnen(
		raster: HTMLElement,
		konferenz: Konferenz,
		ziel: Ziel,
		beitrag: Beitrag | undefined,
		engagements: Map<string, Engagement>,
		nachbarn: { weitere: number; alle: Beitrag[] } = { weitere: 0, alle: [] },
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

		// Raum und Kapazität kaskadieren; sie entscheiden über die Plätze.
		const ort = raumFuer(konferenz, block.id, trackId);

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
		if (beitrag.bloecke.length > 1) {
			fuss.createSpan({ cls: "sms-abzeichen", text: `${beitrag.bloecke.length} Blöcke` });
		}

		this.maxTeilnehmerZeichnen(fuss, zelle, beitrag);

		// Die Plätze dieses Slots: das Minimum aus Wunsch und Raum.
		const plaetze = plaetzeEinesSlots(beitrag, ort.kapazitaet);
		if (plaetze !== undefined) {
			fuss.createSpan({
				cls: "sms-abzeichen",
				text: `${plaetze} Plätze`,
				attr: {
					title:
						beitrag.maxTeilnehmer !== undefined && ort.kapazitaet !== undefined
							? `Beitrag für ${beitrag.maxTeilnehmer}, Raum für ${ort.kapazitaet}`
							: "aus Beitrag oder Raum",
				},
			});
		}

		// Ein Beitrag darf über mehrere Blöcke laufen — hier wächst er.
		if (!this.archiv) {
			this.werkzeug(fuss, "⤓", () => void this.laenger(beitrag), "Einen Block länger");
			if (beitrag.bloecke.length > 1) {
				this.werkzeug(fuss, "⤒", () => void this.kuerzer(beitrag), "Einen Block kürzer");
			}
		}

		// Genannt wird nur die Abweichung vom Track.
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

		// Gewünschte Dauer gegen das, was die Blöcke hergeben. Eine Regel je
		// Format gäbe es nicht: Ein Workshop dauert 90 Minuten oder vier Stunden.
		const vorhanden = dauerImRaster(beitrag, ziel.tag);
		if (beitrag.dauer !== undefined && vorhanden > 0 && beitrag.dauer > vorhanden) {
			zelle.createDiv({
				cls: "sms-slot-hinweis sms-hinweis-rot",
				text: `⚠ braucht ${dauerText(beitrag.dauer)}, hat ${dauerText(vorhanden)}`,
			});
		}

		// Doppelbelegung: Gezeichnet wird nur der erste — ohne diesen Hinweis
		// wäre der zweite unsichtbar, und das ist schlimmer als bunt.
		if (nachbarn.weitere > 0) {
			zelle.createDiv({
				cls: "sms-slot-hinweis sms-hinweis-rot",
				text:
					nachbarn.weitere === 1
						? "⚠ Slot doppelt belegt — ein weiterer Beitrag steht hier"
						: `⚠ Slot mehrfach belegt — ${nachbarn.weitere} weitere Beiträge stehen hier`,
			});
		}

		// Niemand kann um elf an zwei Orten sein.
		const gleichzeitige = zeitgleich(beitrag, nachbarn.alle);
		if (gleichzeitige.length > 0) {
			const orte = gleichzeitige.map((anderer) => this.trackname(konferenz, anderer)).join(", ");
			zelle.createDiv({
				cls: "sms-slot-hinweis sms-hinweis-rot",
				text: `⚠ ${speaker} steht zeitgleich in ${orte}`,
			});
		}

		this.frueheresAnbieten(zelle, beitrag);
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
			(beitrag) => beitrag.bloecke.length === 0 || heimatlos(beitrag, konferenz),
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
				fuss.createSpan({
					cls: "sms-slot-hinweis",
					text: `Block ${beitrag.bloecke.join(", ")} entfallen`,
				});
			} else {
				fuss.createSpan({ cls: "sms-abzeichen", text: "noch nicht platziert" });
			}

			this.umbenennenAnbieten(karte, beitrag);
		}

		// Kandidaten, für die es noch gar keinen Beitrag gibt.
		const mitBeitrag = new Set(beitraege.flatMap((beitrag) => beitrag.speaker));
		const ohneBeitrag = [...engagements.values()].filter(
			(engagement) =>
				engagement.status !== "gestrichen" &&
				!mitBeitrag.has(engagement.speaker) &&
				// Wer durch den Tag führt, wartet auf keinen Slot.
				erwartetBeitrag(engagement),
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
				text:
					"Kandidat in einen freien Slot: sein Beitrag entsteht. " +
					"Auf ein Thema ohne Speaker: er wird eingetragen.",
			});
		}
	}

	/**
	 * Was die Zeile aufnimmt: die Plätze aller belegten Slots zusammen. Bei
	 * parallelen Workshops ist das die Zahl, die zählt — nicht, wie viele Stühle
	 * im Haus stehen, sondern wie viele Gäste um elf Uhr etwas zu tun haben.
	 */
	private plaetzeZeichnen(zeit: HTMLElement, block: Block, tag: Tag, beitraege: Beitrag[]): void {
		const konferenz = this.konferenz;
		if (!konferenz || block.fix) return;

		const gezaehlt = plaetzeEinesBlocks(konferenz, tag, block, beitraege, (blockId, trackId) =>
			raumFuer(konferenz, blockId, trackId).kapazitaet,
		);
		if (gezaehlt.plaetze === 0 && gezaehlt.unbekannt === 0) return;

		const knapp =
			konferenz.teilnehmer !== undefined &&
			gezaehlt.unbekannt === 0 &&
			gezaehlt.plaetze < konferenz.teilnehmer;

		const zeile = zeit.createDiv({
			cls: knapp ? "sms-blockplaetze sms-hinweis-rot" : "sms-blockplaetze",
		});
		zeile.setText(
			knapp
				? `${gezaehlt.plaetze} von ${konferenz.teilnehmer} Plätzen`
				: `${gezaehlt.plaetze} Plätze`,
		);

		const offen: string[] = [];
		if (gezaehlt.frei > 0) offen.push(`+${gezaehlt.frei} frei`);
		if (gezaehlt.unbekannt > 0) offen.push(`${gezaehlt.unbekannt} ohne Zahl`);
		if (offen.length > 0) zeit.createDiv({ cls: "sms-blockplaetze", text: offen.join(", ") });
	}

	/**
	 * Zwischen zwei Blöcken: eine Lücke ist unverplante Zeit, eine
	 * Überschneidung ein Fehler im Raster. Beides fällt sonst niemandem auf,
	 * weil das Gitter die Zeilen bündig untereinander zeichnet.
	 */
	private zwischenraumZeichnen(
		raster: HTMLElement,
		spalten: number,
		zeile: number,
		spanne: number,
	): void {
		const leer = raster.createDiv({ cls: "sms-zeit" });
		leer.style.gridRow = String(zeile);
		leer.style.gridColumn = "1";

		const band = raster.createDiv({
			cls: spanne > 0 ? "sms-zwischenraum" : "sms-zwischenraum sms-ueberschneidung",
		});
		band.style.gridRow = String(zeile);
		band.style.gridColumn = `2 / span ${spalten}`;
		band.setText(
			spanne > 0
				? `${dauerText(spanne)} unverplant`
				: `⚠ ${dauerText(-spanne)} Überschneidung mit dem Block davor`,
		);
	}

	private zeitZeichnen(
		raster: HTMLElement,
		block: Block,
		zeile: number,
		tag?: Tag,
		beitraege: Beitrag[] = [],
	): void {
		const zeit = raster.createDiv({ cls: "sms-zeit" });
		zeit.style.gridRow = String(zeile);
		zeit.style.gridColumn = "1";
		zeit.createDiv({ text: block.von ?? "" });
		zeit.createDiv({ cls: "sms-zeit-bis", text: block.bis ?? "" });

		if (tag) this.plaetzeZeichnen(zeit, block, tag, beitraege);

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
		//
		// Verschoben wird als Block: Was danach kommt, rückt um dieselbe Spanne
		// mit. Gerechnet wird gegen das Ende, damit auch das Verlängern eines
		// Blocks die folgenden schiebt statt sie zu überdecken.
		const sortiert = nachZeit(tag.bloecke);
		const stelle = sortiert.findIndex((eigener) => eigener.id === block.id);
		const verschiebung = minuten(angaben.bis) - minuten(block.bis);

		const bloecke = sortiert.map((eigener, index) => {
			if (eigener.id === block.id) return { id: block.id, ...angaben };
			if (verschiebung === 0 || index < stelle) return eigener;
			return {
				...eigener,
				von: verschoben(eigener.von, verschiebung),
				bis: verschoben(eigener.bis, verschiebung),
			};
		});

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

	/**
	 * Verlängert einen Beitrag um den nächsten freien Block desselben Tages.
	 * Fixblöcke werden übersprungen: Ein Workshop kann durch die Kaffeepause
	 * laufen, belegen kann er sie nicht.
	 */
	private async laenger(beitrag: Beitrag): Promise<void> {
		const tag = this.tagVon(beitrag);
		if (!tag) return;

		const sortiert = nachZeit(tag.bloecke);
		const letzter = [...sortiert].reverse().find((block) => beitrag.bloecke.includes(block.id));
		if (!letzter) return;

		const naechster = sortiert
			.slice(sortiert.indexOf(letzter) + 1)
			.find((block) => !block.fix && !block.plenar);
		if (!naechster) {
			new Notice("Danach kommt an diesem Tag kein Block mehr.");
			return;
		}

		const besetzt = this.daten
			.beitraege()
			.some(
				(anderer) =>
					anderer.konferenz === beitrag.konferenz &&
					anderer.datei !== beitrag.datei &&
					anderer.bloecke.includes(naechster.id) &&
					anderer.track === beitrag.track,
			);
		if (besetzt) {
			new Notice("Der nächste Block ist in diesem Track schon belegt.");
			return;
		}

		await this.schreiber.beitraegePlatzieren([
			{
				datei: beitrag.datei,
				bloecke: [...beitrag.bloecke, naechster.id],
				track: beitrag.track,
			},
		]);
	}

	private async kuerzer(beitrag: Beitrag): Promise<void> {
		if (beitrag.bloecke.length < 2) return;

		const tag = this.tagVon(beitrag);
		const sortiert = tag
			? nachZeit(tag.bloecke)
			: [];
		const letzter = [...sortiert].reverse().find((block) => beitrag.bloecke.includes(block.id));

		await this.schreiber.beitraegePlatzieren([
			{
				datei: beitrag.datei,
				bloecke: beitrag.bloecke.filter((id) => id !== (letzter?.id ?? beitrag.bloecke.at(-1))),
				track: beitrag.track,
			},
		]);
	}

	private tagVon(beitrag: Beitrag): Tag | undefined {
		return this.konferenz?.tage.find((tag) =>
			tag.bloecke.some((block) => beitrag.bloecke.includes(block.id)),
		);
	}

	private beitraegeIn(blockIds: string[]): Beitrag[] {
		const konferenz = this.konferenz;
		if (!konferenz) return [];
		return this.daten
			.beitraege()
			.filter(
				(beitrag) =>
					beitrag.konferenz === konferenz.name &&
					beitrag.bloecke.some((eigener) => blockIds.includes(eigener)),
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
			if (!ziel) return false;
			// Ein Kandidat darf in einen freien Slot — dann entsteht sein Beitrag —
			// und auf ein Thema, das noch keinen Speaker hat.
			return belegtVon === undefined || belegtVon.speaker.length === 0;
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
			else if (belegtVon) void this.speakerZuweisen(zug.engagement, belegtVon);
			else if (ziel) void this.kandidatEinplanen(zug.engagement, ziel);
		});
	}



	private trackname(konferenz: Konferenz, beitrag: Beitrag): string {
		if (!beitrag.track) return "einem plenaren Block";
		return konferenz.tracks.find((track) => track.id === beitrag.track)?.name ?? beitrag.track;
	}

	/** Das Thema stand schon, jetzt steht auch der Mensch. */
	private async speakerZuweisen(engagement: Engagement, beitrag: Beitrag): Promise<void> {
		this.gezogen = null;
		try {
			await this.schreiber.speakerZuweisen(beitrag.datei, engagement.speaker);
		} catch (fehler) {
			new Notice(`Der Speaker ließ sich nicht eintragen: ${String(fehler)}`);
		}
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
		const bloecke = ziel ? zielBloecke(beitrag, ziel.tag, ziel.block.id) : [];
		const track = ziel?.track?.id;
		if (gleich(beitrag.bloecke, bloecke) && beitrag.track === track) return;

		const aenderungen: { datei: TFile; bloecke?: string[]; track?: string }[] = [
			{ datei: beitrag.datei, bloecke, track },
		];
		if (belegtVon) {
			aenderungen.push({
				datei: belegtVon.datei,
				bloecke: beitrag.bloecke,
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
					this.slotOrt(beitrag.bloecke[0], beitrag.track),
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
	 * Die Teilnehmerbegrenzung des Beitrags zum Anklicken. Sie steht nur da,
	 * wenn sie gesetzt ist — sonst erscheint sie beim Überfahren der Karte.
	 * Ein Vortrag im großen Saal braucht sie nicht, ein Workshop schon.
	 */
	private maxTeilnehmerZeichnen(fuss: HTMLElement, zelle: HTMLElement, beitrag: Beitrag): void {
		if (this.archiv) return;

		const wert = beitrag.maxTeilnehmer;
		const anzeige = fuss.createSpan({
			cls: wert === undefined ? "sms-abzeichen sms-max is-offen" : "sms-abzeichen sms-max",
			text: wert === undefined ? "max. —" : `max. ${wert}`,
			attr: { title: "Wie viele Teilnehmende der Beitrag verträgt" },
		});

		anzeige.addEventListener("click", (ereignis) => {
			ereignis.stopPropagation();

			const feld = fuss.createEl("input", { cls: "sms-betragfeld" });
			feld.type = "number";
			feld.value = wert === undefined ? "" : String(wert);
			anzeige.replaceWith(feld);

			// In einem ziehbaren Element ließe sich sonst nichts markieren.
			zelle.draggable = false;
			feld.focus();
			feld.select();

			let fertig = false;
			const beenden = (schreiben: boolean) => {
				if (fertig) return;
				fertig = true;
				zelle.draggable = true;
				if (!schreiben) {
					feld.replaceWith(anzeige);
					return;
				}
				const zahl = feld.value.trim() === "" ? undefined : Number(feld.value);
				void this.zahlSchreiben(beitrag, Number.isFinite(zahl) ? zahl : undefined);
			};

			feld.addEventListener("keydown", (taste) => {
				if (taste.key === "Enter") beenden(true);
				if (taste.key === "Escape") beenden(false);
			});
			feld.addEventListener("blur", () => beenden(true));
			feld.addEventListener("click", (eigenes) => eigenes.stopPropagation());
		});
	}

	private async zahlSchreiben(beitrag: Beitrag, wert: number | undefined): Promise<void> {
		if (beitrag.maxTeilnehmer === wert) return;
		try {
			await this.schreiber.zahlSetzen(beitrag.datei, "max_teilnehmer", wert);
		} catch (fehler) {
			new Notice(`Die Teilnehmerzahl ließ sich nicht schreiben: ${String(fehler)}`);
		}
	}

	/**
	 * Steht der Speaker fest und das Thema noch nicht, zeigt die Karte, womit er
	 * früher schon einmal da war. Ein Klick öffnet die alte Notiz — dort steht
	 * das Abstract, an dem man sich entlanghangeln kann.
	 */
	private frueheresAnbieten(karte: HTMLElement, beitrag: Beitrag): void {
		const speaker = beitrag.speaker[0];
		if (!speaker || beitrag.titel) return;

		const frueher = frueherGehalten(
			speaker,
			beitrag.konferenz,
			this.alleBeitraege,
			this.alleKonferenzen,
		);
		if (frueher.length === 0) return;

		const kasten = karte.createDiv({ cls: "sms-frueher" });
		kasten.createDiv({ cls: "sms-frueher-kopf", text: "Früher gehalten:" });

		for (const eintrag of frueher) {
			const zeile = kasten.createDiv({ cls: "sms-frueher-zeile" });
			zeile.createSpan({ cls: "sms-umbenennen", text: `„${eintrag.titel}“` });
			zeile.createSpan({ text: ` · ${jahrAus(eintrag) ?? eintrag.konferenz}` });
			zeile.addEventListener("click", (ereignis) => {
				ereignis.stopPropagation();
				this.notizOeffnen(eintrag.beitrag.datei);
			});
		}
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
		const gezaehlt = slotsEinesTages(konferenz, tag, (blockId, trackId) =>
			beitraege.some(
				(beitrag) =>
					beitrag.bloecke.includes(blockId) &&
					(trackId === undefined || beitrag.track === trackId),
			),
		);
		return gezaehlt.gesamt - gezaehlt.belegt;
	}
}



function gleich(einer: string[], anderer: string[]): boolean {
	return einer.length === anderer.length && einer.every((wert, i) => wert === anderer[i]);
}

/** Wird der Beitrag in diesem Block gezeichnet, oder lief er schon vorher? */
function istErsterBlock(beitrag: Beitrag, blockId: string, bloecke: Block[]): boolean {
	const erster = bloecke.find((block) => beitrag.bloecke.includes(block.id));
	return erster?.id === blockId;
}

/**
 * Über wie viele Gitterzeilen die Zelle reicht. Zwischen dem ersten und dem
 * letzten Block können Lücken- und Überschneidungszeilen liegen; die zählen mit,
 * sonst rutscht die Zelle aus dem Raster.
 */
function hoehe(
	beitrag: Beitrag | undefined,
	block: Block,
	bloecke: Block[],
	zeileVon: (blockId: string) => number,
	eigeneZeile: number,
): number {
	if (!beitrag || beitrag.bloecke.length < 2) return 1;

	const letzter = [...bloecke].reverse().find((eigener) => beitrag.bloecke.includes(eigener.id));
	if (!letzter || letzter.id === block.id) return 1;

	return Math.max(1, zeileVon(letzter.id) - eigeneZeile + 1);
}


/** Aus 75 wird `1 Std 15 Min`. */
function dauerText(minuten: number): string {
	const stunden = Math.floor(minuten / 60);
	const rest = minuten % 60;
	if (stunden === 0) return `${rest} Min`;
	return rest === 0 ? `${stunden} Std` : `${stunden} Std ${rest} Min`;
}


/** „2025" — knapper als der ganze Konferenzname, und die Frage ist ja das Jahr. */
function jahrAus(eintrag: { datum?: string }): string | undefined {
	return eintrag.datum?.slice(0, 4);
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
