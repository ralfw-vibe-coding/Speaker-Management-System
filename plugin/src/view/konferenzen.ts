import type { TFile } from "obsidian";
import type { Datenzugriff } from "../daten/lesen";
import {
	ZUGESAGT_UND_WEITER,
	istArchiv,
	slotsEinesTages,
	type Konferenz,
} from "../daten/modell";

/** Was auf einer Konferenzkarte steht — alles gerechnet, nichts gespeichert. */
interface Karte {
	konferenz: Konferenz;
	spanne?: string;
	kandidaten: number;
	zugesagt: number;
	honorar: number;
	slots: number;
	belegt: number;
	imPool: number;
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

const STATUS_TITEL: Record<string, string> = {
	idee: "Idee",
	planung: "in Planung",
	"programm-steht": "Programm steht",
	gelaufen: "gelaufen",
	abgesagt: "abgesagt",
};

/**
 * Die Übersicht über alle Konferenzen: was ansteht und was gelaufen ist.
 * Konferenzübergreifend wie der Katalog — hier wählt man aus, woran man
 * arbeitet, statt es im Kopf zu suchen.
 */
export class Konferenzuebersicht {
	constructor(
		private daten: Datenzugriff,
		private notizOeffnen: (datei: TFile) => void,
		private waehlen: (name: string) => void,
		private konferenzAnlegen: (vorhandene: string[]) => void,
	) {}

	zeichnen(buehne: HTMLElement): void {
		buehne.empty();
		buehne.addClass("sms-konferenzen");

		const karten = this.karten();

		const leiste = buehne.createDiv({ cls: "sms-leiste" });
		leiste.createSpan({
			cls: "sms-zaehler",
			text: karten.length === 1 ? "1 Konferenz" : `${karten.length} Konferenzen`,
		});
		const anlegen = leiste.createEl("button", {
			cls: "sms-anlegen mod-cta",
			text: "＋ Konferenz",
		});
		anlegen.addEventListener("click", () =>
			this.konferenzAnlegen(karten.map((karte) => karte.konferenz.name)),
		);

		if (karten.length === 0) {
			buehne.createEl("p", {
				cls: "sms-leer",
				text: "Noch keine Konferenz. Der Knopf oben rechts legt die erste an.",
			});
			return;
		}

		// Was ansteht, zuerst und aufsteigend: Die nächste ist die dringendste.
		const bevorstehend = karten
			.filter((karte) => !istArchiv(karte.konferenz))
			.sort((a, b) => beginn(a).localeCompare(beginn(b)));
		const archiv = karten
			.filter((karte) => istArchiv(karte.konferenz))
			.sort((a, b) => beginn(b).localeCompare(beginn(a)));

		this.abschnitt(buehne, "Bevorstehend", bevorstehend);
		this.abschnitt(buehne, "Archiv", archiv);
	}

	private karten(): Karte[] {
		const engagements = this.daten.engagements();
		const beitraege = this.daten.beitraege();

		return this.daten.konferenzen().map((konferenz) => {
			const eigene = engagements.filter((e) => e.konferenz === konferenz.name);
			const aktiv = eigene.filter((e) => e.status !== "gestrichen");
			const eigeneBeitraege = beitraege.filter((b) => b.konferenz === konferenz.name);

			let slots = 0;
			let belegt = 0;
			for (const tag of konferenz.tage) {
				const gezaehlt = slotsEinesTages(konferenz, tag, (blockId, trackId) =>
					eigeneBeitraege.some(
						(beitrag) =>
							beitrag.block === blockId &&
							(trackId === undefined || beitrag.track === trackId),
					),
				);
				slots += gezaehlt.gesamt;
				belegt += gezaehlt.belegt;
			}

			return {
				konferenz,
				spanne: datumsspanne(konferenz),
				kandidaten: aktiv.length,
				zugesagt: eigene.filter((e) => ZUGESAGT_UND_WEITER.includes(e.status)).length,
				honorar: aktiv.reduce((summe, e) => summe + (e.honorar ?? 0), 0),
				slots,
				belegt,
				imPool: eigeneBeitraege.filter((beitrag) => !beitrag.block).length,
			};
		});
	}

	private abschnitt(buehne: HTMLElement, titel: string, karten: Karte[]): void {
		if (karten.length === 0) return;

		const kopf = buehne.createDiv({ cls: "sms-spalte-kopf sms-abschnittskopf" });
		kopf.createSpan({ cls: "sms-spalte-titel", text: titel });
		kopf.createSpan({ cls: "sms-spalte-zahl", text: String(karten.length) });

		const liste = buehne.createDiv({ cls: "sms-karten" });
		for (const karte of karten) this.karteZeichnen(liste, karte);
	}

	private karteZeichnen(liste: HTMLElement, karte: Karte): void {
		const { konferenz } = karte;

		const kasten = liste.createDiv({ cls: "sms-karte sms-konferenzkarte" });
		// Ein Klick wählt sie aus — von hier aus arbeitet man weiter.
		kasten.addEventListener("click", () => this.waehlen(konferenz.name));

		const kopf = kasten.createDiv({ cls: "sms-karte-kopf" });
		kopf.createSpan({ cls: "sms-name", text: konferenz.name });
		kopf.createSpan({
			cls: `sms-abzeichen sms-status-${konferenz.status ?? "idee"}`,
			text: STATUS_TITEL[konferenz.status ?? ""] ?? konferenz.status ?? "ohne Status",
		});

		const unterzeile = [konferenz.untertitel, konferenz.veranstalter, karte.spanne].filter(
			(teil): teil is string => !!teil,
		);
		if (unterzeile.length > 0) {
			kasten.createDiv({ cls: "sms-rolle", text: unterzeile.join(" · ") });
		}

		const zahlen = kasten.createDiv({ cls: "sms-zeile" });
		if (karte.slots > 0) {
			zahlen.createSpan({ text: `${karte.belegt} von ${karte.slots} Slots belegt` });
		}
		if (karte.kandidaten > 0) {
			zahlen.createSpan({ text: `${karte.kandidaten} Kandidaten · ${karte.zugesagt} zugesagt` });
		}
		if (karte.honorar > 0) {
			const budget = konferenz.honorarbudget;
			zahlen.createSpan({
				text: budget
					? `${euro(karte.honorar)} von ${euro(budget)}`
					: euro(karte.honorar),
			});
		}

		const hinweise = kasten.createDiv({ cls: "sms-hinweise" });
		if (karte.slots > 0 && karte.belegt < karte.slots) {
			hinweise.createDiv({
				cls: "sms-hinweis",
				text: `${karte.slots - karte.belegt} Slots noch frei`,
			});
		}
		if (karte.imPool > 0) {
			hinweise.createDiv({ cls: "sms-hinweis", text: `${karte.imPool} im Pool` });
		}
		if (konferenz.deadlineProgramm && !istArchiv(konferenz)) {
			hinweise.createDiv({
				cls: "sms-hinweis sms-hinweis-gelb",
				text: `Deadline Programm ${kurzesDatum(konferenz.deadlineProgramm)}`,
			});
		}
		if (konferenz.tage.length === 0) {
			hinweise.createDiv({ cls: "sms-hinweis", text: "noch ohne Termin und Raster" });
		}

		const notiz = kasten.createSpan({ cls: "sms-umbenennen", text: "Notiz öffnen" });
		notiz.addEventListener("click", (ereignis) => {
			ereignis.stopPropagation();
			this.notizOeffnen(konferenz.datei);
		});
	}
}

function beginn(karte: Karte): string {
	// Ohne Termin ans Ende — eine Idee drängt nicht.
	return karte.konferenz.tage[0]?.datum ?? "9999";
}

function euro(wert: number): string {
	return `${wert.toLocaleString("de-DE")} €`;
}

function kurzesDatum(iso: string): string {
	const teile = iso.split("-");
	return teile.length < 3 ? iso : `${teile[2]}.${teile[1]}.`;
}

function datumsspanne(konferenz: Konferenz): string | undefined {
	const daten = konferenz.tage
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
	return `${von.tag}. ${MONATE[von.monat - 1]} – ${bis.tag}. ${MONATE[bis.monat - 1]} ${bis.jahr}`;
}

function zerlegen(iso: string): { jahr: number; monat: number; tag: number } | undefined {
	const treffer = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
	if (!treffer) return undefined;
	return { jahr: Number(treffer[1]), monat: Number(treffer[2]), tag: Number(treffer[3]) };
}
