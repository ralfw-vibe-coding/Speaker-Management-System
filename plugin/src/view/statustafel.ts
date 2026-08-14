import { Notice, type App, type TFile } from "obsidian";
import type { Datenzugriff } from "../daten/lesen";
import type { Datenschreiber } from "../daten/schreiben";
import { heimatlos } from "../daten/projektion";
import { StreichenModal } from "./StreichenModal";
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
	/** Die Karten der gerade gezeichneten Tafel — Grundlage fürs Umsortieren. */
	private aktuelle: Karte[] = [];
	private konferenz: Konferenz | undefined;
	private gezogen: Karte | null = null;
	private gezogenEl: HTMLElement | null = null;
	private marke: HTMLElement | null = null;
	private zielIndex = 0;

	constructor(
		private app: App,
		private daten: Datenzugriff,
		private schreiber: Datenschreiber,
		private notizOeffnen: (datei: TFile) => void,
	) {}

	async zeichnen(buehne: HTMLElement, konferenz: Konferenz | undefined): Promise<void> {
		buehne.empty();
		buehne.addClass("sms-tafel");
		this.konferenz = konferenz;

		if (!konferenz) {
			buehne.createEl("p", {
				cls: "sms-leer",
				text: "Keine Konferenz gefunden. Stimmt der Konferenzordner in den Einstellungen?",
			});
			return;
		}

		const karten = await this.karten(konferenz);
		this.aktuelle = karten;

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
				imPool: eigene.filter((beitrag) => beitrag.bloecke.length === 0).length,
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
		const reise = aktiv.reduce((summe, k) => summe + (k.engagement.reisekosten ?? 0), 0);

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
		// Reisekosten laufen nicht gegen das Honorarbudget: Der Veranstalter
		// erstattet sie gesondert. Deshalb eine eigene Zahl, keine Addition.
		if (reise > 0) zeile.createSpan({ text: ` · Reisekosten ${euro(reise)}` });

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

		spalte.addEventListener("dragover", (ereignis) => {
			if (!this.gezogen) return;
			ereignis.preventDefault();
			spalte.addClass("is-ziel");
			this.zielIndex = this.markeSetzen(spalte, ereignis.clientY);
		});

		spalte.addEventListener("dragleave", (ereignis) => {
			// dragleave feuert auch beim Wechsel auf ein Kindelement.
			if (spalte.contains(ereignis.relatedTarget as Node)) return;
			spalte.removeClass("is-ziel");
		});

		spalte.addEventListener("drop", (ereignis) => {
			if (!this.gezogen) return;
			ereignis.preventDefault();
			spalte.removeClass("is-ziel");
			void this.verschieben(status, this.zielIndex);
		});

		for (const karte of karten) this.karteZeichnen(spalte, karte);
	}

	private karteZeichnen(spalte: HTMLElement, karte: Karte): void {
		const { engagement, speaker } = karte;

		const kasten = spalte.createDiv({ cls: "sms-karte sms-tafel-karte" });
		if (karte.gesamt > 0 && karte.erledigt === karte.gesamt) kasten.addClass("is-vollstaendig");
		kasten.addEventListener("click", () => this.notizOeffnen(engagement.datei));

		kasten.draggable = true;
		kasten.addEventListener("dragstart", (ereignis) => {
			this.gezogen = karte;
			this.gezogenEl = kasten;
			kasten.addClass("is-zieht");
			// Ohne Nutzlast startet in Electron kein Zug.
			ereignis.dataTransfer?.setData("text/plain", engagement.datei.path);
			if (ereignis.dataTransfer) ereignis.dataTransfer.effectAllowed = "move";
		});
		kasten.addEventListener("dragend", () => {
			kasten.removeClass("is-zieht");
			this.aufraeumen();
		});

		kasten.createDiv({ cls: "sms-name", text: engagement.speaker });

		if (speaker && speaker.themen.length > 0) {
			kasten.createDiv({ cls: "sms-rolle", text: speaker.themen.slice(0, 2).join(" & ") });
		}

		const teile: string[] = [];
		if (karte.beitraege.length > 0) {
			teile.push(karte.beitraege.length === 1 ? "1 Beitrag" : `${karte.beitraege.length} Beiträge`);
		}
		if (engagement.honorar !== undefined) teile.push(euro(engagement.honorar));
		if (engagement.reisekosten !== undefined) {
			teile.push(`${euro(engagement.reisekosten)} Reise`);
		}
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

	// ----------------------------------------------------------- Umsortieren

	/**
	 * Setzt die Einfügemarke dorthin, wo die Karte landen würde, und meldet den
	 * Index. Gerechnet wird gegen die Mitten der Karten, die schon dort liegen —
	 * die gezogene zählt nicht mit, sie verlässt ihren Platz ja.
	 */
	private markeSetzen(spalte: HTMLElement, y: number): number {
		const vorhandene = Array.from(
			spalte.querySelectorAll<HTMLElement>(".sms-tafel-karte"),
		).filter((element) => element !== this.gezogenEl);

		let index = vorhandene.length;
		for (let i = 0; i < vorhandene.length; i++) {
			const kasten = vorhandene[i].getBoundingClientRect();
			if (y < kasten.top + kasten.height / 2) {
				index = i;
				break;
			}
		}

		if (!this.marke) {
			this.marke = document.createElement("div");
			this.marke.className = "sms-einfuegemarke";
		}

		const davor = vorhandene[index];
		if (davor) spalte.insertBefore(this.marke, davor);
		else spalte.appendChild(this.marke);

		return index;
	}

	private aufraeumen(): void {
		this.marke?.remove();
		this.marke = null;
		this.gezogen = null;
		this.gezogenEl = null;
		for (const spalte of Array.from(document.querySelectorAll(".sms-spalte.is-ziel"))) {
			spalte.classList.remove("is-ziel");
		}
	}

	/**
	 * Nummeriert die betroffenen Spalten neu und schreibt sie in einem
	 * Durchgang. Die Zielspalte rückt an der Einfügestelle auf, die Quellspalte
	 * wird geschlossen — sonst bliebe dort eine Lücke, die beim nächsten Zug
	 * wieder auffällt. Geschrieben wird nur, was sich wirklich ändert.
	 */
	private async verschieben(zielStatus: string, index: number): Promise<void> {
		const karte = this.gezogen;
		this.aufraeumen();
		if (!karte) return;

		const quellStatus = karte.engagement.status;
		const nachPosition = (a: Karte, b: Karte) =>
			a.engagement.position - b.engagement.position ||
			a.engagement.speaker.localeCompare(b.engagement.speaker, "de");

		const ziel = this.aktuelle
			.filter((k) => k.engagement.status === zielStatus && k !== karte)
			.sort(nachPosition);
		ziel.splice(Math.max(0, Math.min(index, ziel.length)), 0, karte);

		const aenderungen: { datei: TFile; status: string; position: number }[] = [];
		const merken = (k: Karte, status: string, position: number) => {
			if (k.engagement.status === status && k.engagement.position === position) return;
			aenderungen.push({ datei: k.engagement.datei, status, position });
		};

		ziel.forEach((k, i) => merken(k, zielStatus, i));

		if (quellStatus !== zielStatus) {
			this.aktuelle
				.filter((k) => k.engagement.status === quellStatus && k !== karte)
				.sort(nachPosition)
				.forEach((k, i) => merken(k, quellStatus, i));
		}

		// Streichen ist mehr als ein Spaltenwechsel — erst fragen, dann schreiben.
		const streichen = zielStatus === "gestrichen" && quellStatus !== "gestrichen";
		if (streichen && karte.beitraege.length > 0) {
			const bestaetigt = await new StreichenModal(
				this.app,
				karte.engagement.speaker,
				karte.beitraege.map((beitrag) => ({
					titel: beitrag.titel,
					ort: this.ortsangabe(beitrag),
					behalten: !!beitrag.titel,
				})),
			).frage();
			if (!bestaetigt) return;
		}

		try {
			if (aenderungen.length > 0) await this.schreiber.statusUndPosition(aenderungen);
			if (streichen) await this.streichen(karte);
		} catch (fehler) {
			new Notice(`Die Karte ließ sich nicht verschieben: ${String(fehler)}`);
		}
	}

	/**
	 * Die Slots werden wieder Löcher, die Themen bleiben. Was vorgesehen war,
	 * bleibt als Spur im Engagement — sonst wüsste in einem Jahr niemand mehr,
	 * was mit dieser Absage verlorenging.
	 */
	private async streichen(karte: Karte): Promise<void> {
		if (karte.beitraege.length === 0) return;

		const zeilen = karte.beitraege.map(
			(beitrag) => `- ${beitrag.titel ? `„${beitrag.titel}“` : "ohne Thema"} · ${this.ortsangabe(beitrag)}`,
		);

		await this.schreiber.beitraegeStreichen(karte.beitraege);
		await this.schreiber.spurAnhaengen(
			karte.engagement.datei,
			[
				"## Gestrichen",
				`Am ${new Date().toLocaleDateString("de-DE")} gestrichen. Vorgesehen war:`,
				...zeilen,
			].join("\n"),
		);
	}

	/** „Mi 12:00 · Werkzeuge & KI" — oder „im Pool", wenn es keinen Platz gab. */
	private ortsangabe(beitrag: Beitrag): string {
		const konferenz = this.konferenz;
		if (!konferenz || beitrag.bloecke.length === 0) return "im Pool";

		for (const tag of konferenz.tage) {
			const block = tag.bloecke.find((b) => beitrag.bloecke.includes(b.id));
			if (!block) continue;

			const track = konferenz.tracks.find((t) => t.id === beitrag.track);
			const teile = [tag.datum ? kurzerTag(tag.datum) : undefined, block.von, track?.name]
				.filter((teil): teil is string => !!teil);
			const ort = teile.join(" ") || block.id;
			return beitrag.bloecke.length > 1 ? `${ort} (${beitrag.bloecke.length} Blöcke)` : ort;
		}
		return `Block ${beitrag.bloecke.join(", ")} (entfallen)`;
	}
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

/** Aus `2026-11-04` wird `Mi`. */
function kurzerTag(iso: string): string {
	const zerlegt = zerlegen(iso);
	if (!zerlegt) return iso;
	const wochentage = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
	return wochentage[new Date(zerlegt.jahr, zerlegt.monat - 1, zerlegt.tag).getDay()];
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
