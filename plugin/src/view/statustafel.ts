import type { TFile } from "obsidian";
import type { Datenzugriff } from "../daten/lesen";
import {
	FUNNEL,
	FUNNEL_TITEL,
	ZUGESAGT_UND_WEITER,
	type Beitrag,
	type Engagement,
	type Konferenz,
	type Speaker,
	type Tag,
} from "../daten/modell";

/** Eine Karte auf der Tafel. Alles außer `engagement` ist gerechnet. */
interface Karte {
	engagement: Engagement;
	speaker?: Speaker;
	beitraege: Beitrag[];
	erledigt: number;
	gesamt: number;
	imPool: number;
	heimatlos: number;
	ohneThema: number;
	/** Nur gesetzt, wenn angefragt wurde und keine Antwort kam. */
	wochenOhneAntwort?: number;
}

const MONATE = [
	"Januar",
	"Februar",
	"März",
	"April",
	"Mai",
	"Juni",
	"Juli",
	"August",
	"September",
	"Oktober",
	"November",
	"Dezember",
];

/**
 * Die Statustafel einer Konferenz: die Kandidaten als Karten im Funnel.
 * Sie hält keinen eigenen Zustand — Spalte und Zeile stehen im Engagement,
 * alles andere ist aus Engagements, Beiträgen und dem Raster gerechnet.
 */
export class Statustafel {
	constructor(
		private daten: Datenzugriff,
		private notizOeffnen: (datei: TFile) => void,
	) {}

	async zeichnen(buehne: HTMLElement, konferenz: Konferenz | undefined): Promise<void> {
		buehne.empty();
		buehne.addClass("sms-tafel");

		if (!konferenz) {
			buehne.createEl("p", {
				cls: "sms-leer",
				text: "Keine Konferenz gefunden. Stimmt der Konferenzordner in den Einstellungen?",
			});
			return;
		}

		const karten = await this.karten(konferenz);

		this.kopfZeichnen(buehne, konferenz, karten);

		const spalten = buehne.createDiv({ cls: "sms-spalten" });
		for (const status of FUNNEL) {
			const eigene = karten
				.filter((karte) => karte.engagement.status === status)
				.sort(
					(a, b) =>
						a.engagement.position - b.engagement.position ||
						a.engagement.speaker.localeCompare(b.engagement.speaker, "de"),
				);
			this.spalteZeichnen(spalten, status, eigene);
		}
	}

	// ---------------------------------------------------------------- Daten

	private async karten(konferenz: Konferenz): Promise<Karte[]> {
		const engagements = this.daten
			.engagements()
			.filter((engagement) => engagement.konferenz === konferenz.name);
		const beitraege = this.daten
			.beitraege()
			.filter((beitrag) => beitrag.konferenz === konferenz.name);
		const speaker = new Map((await this.daten.speaker()).map((s) => [s.name, s]));

		return engagements.map((engagement) => {
			const eigene = beitraege.filter((beitrag) => beitrag.speaker.includes(engagement.speaker));

			// Der Balken zählt das Engagement und alle Beiträge dieses Speakers
			// zusammen: „inhaltlich fertig" ist beides zusammen.
			let erledigt = engagement.aufgaben.erledigt;
			let gesamt = engagement.aufgaben.gesamt;
			for (const beitrag of eigene) {
				erledigt += beitrag.aufgaben.erledigt;
				gesamt += beitrag.aufgaben.gesamt;
			}

			return {
				engagement,
				speaker: speaker.get(engagement.speaker),
				beitraege: eigene,
				erledigt,
				gesamt,
				imPool: eigene.filter((beitrag) => !beitrag.block).length,
				heimatlos: eigene.filter((beitrag) => heimatlos(beitrag, konferenz)).length,
				ohneThema: eigene.filter((beitrag) => !beitrag.titel).length,
				wochenOhneAntwort: wochenOhneAntwort(engagement),
			};
		});
	}

	// -------------------------------------------------------------- Zeichnen

	private kopfZeichnen(buehne: HTMLElement, konferenz: Konferenz, karten: Karte[]): void {
		const aktiv = karten.filter((k) => k.engagement.status !== "gestrichen");
		const zugesagt = karten.filter((k) => ZUGESAGT_UND_WEITER.includes(k.engagement.status));
		const gestrichen = karten.filter((k) => k.engagement.status === "gestrichen");
		const honorar = aktiv.reduce((summe, k) => summe + (k.engagement.honorar ?? 0), 0);

		const kopf = buehne.createDiv({ cls: "sms-tafel-kopf" });

		const links = kopf.createDiv();
		links.createDiv({ cls: "sms-konferenz", text: konferenz.name });

		const untertitel = [
			konferenz.untertitel,
			konferenz.veranstalter,
			datumsspanne(konferenz.tage),
		].filter((teil): teil is string => !!teil);
		if (untertitel.length > 0) {
			links.createDiv({ cls: "sms-konferenz-zeile", text: untertitel.join(" · ") });
		}

		const rechts = kopf.createDiv({ cls: "sms-kennzahlen" });

		const marken = rechts.createDiv({ cls: "sms-marken" });
		marken.createSpan({ cls: "sms-marke", text: `${aktiv.length} Kandidaten` });
		marken.createSpan({ cls: "sms-marke sms-marke-gruen", text: `${zugesagt.length} zugesagt` });
		marken.createSpan({ cls: "sms-marke sms-marke-rot", text: `${gestrichen.length} gestrichen` });

		const zeile = rechts.createDiv({ cls: "sms-konferenz-zeile" });
		const budget = konferenz.honorarbudget;
		zeile.createSpan({
			text: budget
				? `Honorar ${euro(honorar)} von ${euro(budget)}`
				: `Honorar ${euro(honorar)}`,
		});
		if (konferenz.deadlineProgramm) {
			zeile.createSpan({ text: ` · Deadline Programm ${kurzesDatum(konferenz.deadlineProgramm)}` });
		}
	}

	private spalteZeichnen(eltern: HTMLElement, status: string, karten: Karte[]): void {
		const spalte = eltern.createDiv({ cls: `sms-spalte sms-spalte-${status}` });

		const kopf = spalte.createDiv({ cls: "sms-spalte-kopf" });
		kopf.createSpan({ cls: `sms-punkt sms-punkt-${status}` });
		kopf.createSpan({ cls: "sms-spalte-titel", text: FUNNEL_TITEL[status] ?? status });
		kopf.createSpan({ cls: "sms-spalte-zahl", text: karten.length > 0 ? String(karten.length) : "" });

		for (const karte of karten) this.karteZeichnen(spalte, karte);
	}

	private karteZeichnen(spalte: HTMLElement, karte: Karte): void {
		const { engagement, speaker } = karte;

		const kasten = spalte.createDiv({ cls: "sms-karte sms-tafel-karte" });
		if (karte.gesamt > 0 && karte.erledigt === karte.gesamt) kasten.addClass("is-vollstaendig");
		kasten.addEventListener("click", () => this.notizOeffnen(engagement.datei));

		kasten.createDiv({ cls: "sms-name", text: engagement.speaker });

		if (speaker && speaker.themen.length > 0) {
			kasten.createDiv({ cls: "sms-rolle", text: speaker.themen.slice(0, 2).join(" & ") });
		}

		const teile: string[] = [];
		if (karte.beitraege.length > 0) {
			teile.push(karte.beitraege.length === 1 ? "1 Beitrag" : `${karte.beitraege.length} Beiträge`);
		}
		if (engagement.honorar !== undefined) teile.push(euro(engagement.honorar));
		if (teile.length > 0) kasten.createDiv({ cls: "sms-zeile", text: teile.join(" · ") });

		if (karte.gesamt > 0 && karte.erledigt > 0) {
			const balken = kasten.createDiv({ cls: "sms-balken" });
			const fuellung = balken.createDiv({ cls: "sms-balken-fuellung" });
			fuellung.style.width = `${Math.round((karte.erledigt / karte.gesamt) * 100)}%`;
			kasten.createDiv({
				cls: "sms-balken-text",
				text: `${karte.erledigt} von ${karte.gesamt} erledigt`,
			});
		}

		const hinweise = kasten.createDiv({ cls: "sms-hinweise" });
		if (karte.gesamt > 0 && karte.erledigt === karte.gesamt) {
			hinweise.createDiv({ cls: "sms-hinweis sms-hinweis-gruen", text: "✓ vollständig" });
		}
		if (karte.heimatlos > 0) {
			hinweise.createDiv({
				cls: "sms-hinweis sms-hinweis-rot",
				text: `⚠ ${anzahl(karte.heimatlos, "Beitrag", "Beiträge")} heimatlos`,
			});
		}
		if (karte.imPool > 0) {
			hinweise.createDiv({ cls: "sms-hinweis", text: `${karte.imPool} im Pool` });
		}
		if (karte.ohneThema > 0) {
			hinweise.createDiv({ cls: "sms-hinweis", text: `${karte.ohneThema} ohne Thema` });
		}
		if (karte.wochenOhneAntwort !== undefined && karte.wochenOhneAntwort > 0) {
			hinweise.createDiv({
				cls: "sms-hinweis sms-hinweis-gelb",
				text: `⏱ ${karte.wochenOhneAntwort} Wochen ohne Antwort`,
			});
		}
	}
}

/**
 * Heimatlos ist ein Beitrag, dessen Slot es nicht mehr gibt: Der Block fehlt
 * im Raster, oder sein Track ist an diesem Tag nicht dabei. Ein Beitrag ganz
 * ohne Block liegt dagegen im Pool und ist nicht heimatlos.
 */
function heimatlos(beitrag: Beitrag, konferenz: Konferenz): boolean {
	if (!beitrag.block) return false;

	const tag = konferenz.tage.find((t) => t.bloecke.some((block) => block.id === beitrag.block));
	if (!tag) return true;
	if (!beitrag.track) return false;

	if (!konferenz.tracks.some((track) => track.id === beitrag.track)) return true;
	return tag.tracks.length > 0 && !tag.tracks.includes(beitrag.track);
}

function wochenOhneAntwort(engagement: Engagement): number | undefined {
	if (engagement.status !== "angefragt") return undefined;
	if (!engagement.angefragtAm || engagement.geantwortetAm) return undefined;

	const angefragt = Date.parse(engagement.angefragtAm);
	if (Number.isNaN(angefragt)) return undefined;

	const tage = (Date.now() - angefragt) / 86_400_000;
	return tage > 0 ? Math.floor(tage / 7) : undefined;
}

function anzahl(wert: number, einzahl: string, mehrzahl: string): string {
	return `${wert} ${wert === 1 ? einzahl : mehrzahl}`;
}

function euro(wert: number): string {
	return `${wert.toLocaleString("de-DE")} €`;
}

/** Aus `2026-09-30` wird `30.09.` */
function kurzesDatum(iso: string): string {
	const teile = iso.split("-");
	if (teile.length < 3) return iso;
	return `${teile[2]}.${teile[1]}.`;
}

/** Aus zwei Tagen wird `4.–5. November 2026`, aus einem `4. November 2026`. */
function datumsspanne(tage: Tag[]): string | undefined {
	const daten = tage
		.map((tag) => tag.datum)
		.filter((datum): datum is string => !!datum)
		.sort();
	if (daten.length === 0) return undefined;

	const von = zerlegen(daten[0]);
	const bis = zerlegen(daten[daten.length - 1]);
	if (!von || !bis) return undefined;

	if (von.jahr === bis.jahr && von.monat === bis.monat && von.tag === bis.tag) {
		return `${von.tag}. ${MONATE[von.monat - 1]} ${von.jahr}`;
	}
	if (von.jahr === bis.jahr && von.monat === bis.monat) {
		return `${von.tag}.–${bis.tag}. ${MONATE[von.monat - 1]} ${von.jahr}`;
	}
	if (von.jahr === bis.jahr) {
		return `${von.tag}. ${MONATE[von.monat - 1]} – ${bis.tag}. ${MONATE[bis.monat - 1]} ${von.jahr}`;
	}
	return (
		`${von.tag}. ${MONATE[von.monat - 1]} ${von.jahr} – ` +
		`${bis.tag}. ${MONATE[bis.monat - 1]} ${bis.jahr}`
	);
}

function zerlegen(iso: string): { jahr: number; monat: number; tag: number } | undefined {
	const treffer = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
	if (!treffer) return undefined;
	return {
		jahr: Number(treffer[1]),
		monat: Number(treffer[2]),
		tag: Number(treffer[3]),
	};
}
