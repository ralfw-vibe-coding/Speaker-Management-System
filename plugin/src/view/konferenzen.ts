import { Notice, type App, type TFile } from "obsidian";
import type { Datenzugriff } from "../daten/lesen";
import type { Datenschreiber } from "../daten/schreiben";
import { verwaisteVerweise } from "../daten/projektion";
import { nachAgeordnet, Nachtragen } from "../daten/migration";
import { BestaetigenModal } from "./rasterModale";
import {
	KONFERENZSTATUS,
	KONFERENZSTATUS_TITEL,
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
	reisekosten: number;
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

/**
 * Die Übersicht über alle Konferenzen: was ansteht und was gelaufen ist.
 * Konferenzübergreifend wie der Katalog — hier wählt man aus, woran man
 * arbeitet, statt es im Kopf zu suchen.
 */
export class Konferenzuebersicht {
	constructor(
		private app: App,
		private daten: Datenzugriff,
		private schreiber: Datenschreiber,
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

		this.nachtraegeZeichnen(buehne);
		this.beanstandungenZeichnen(buehne);

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
							beitrag.bloecke.includes(blockId) &&
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
				reisekosten: aktiv.reduce((summe, e) => summe + (e.reisekosten ?? 0), 0),
				slots,
				belegt,
				imPool: eigeneBeitraege.filter((beitrag) => beitrag.bloecke.length === 0).length,
			};
		});
	}

	/**
	 * Notizen, die eine ältere Version angelegt hat, kennen neuere Felder nicht.
	 * Schaden entsteht dadurch keiner — gelesen wird tolerant —, aber Obsidian
	 * zeigt eine Eigenschaft nicht an, die in der Datei fehlt. Deshalb dieser
	 * Hinweis: **erkannt vom Plugin, ausgeführt auf Klick.** Von selbst schreibt
	 * es nach einem Update in keine einzige Notiz.
	 */
	private nachtraegeZeichnen(buehne: HTMLElement): void {
		const nachtragen = new Nachtragen(this.app);
		const nachtraege = nachtragen.suchen(this.daten.verwalteteNotizen());
		if (nachtraege.length === 0) return;

		const kasten = buehne.createDiv({ cls: "sms-nachtrag" });
		kasten.createDiv({
			cls: "sms-nachtrag-kopf",
			text: `${nachtraege.length} Notizen kennen neuere Felder noch nicht`,
		});
		kasten.createDiv({
			cls: "sms-beanstandung",
			text: `${nachAgeordnet(nachtraege)} — die Felder werden leer ergänzt, nichts Vorhandenes geändert.`,
		});

		const knopf = kasten.createEl("button", { cls: "sms-chip", text: "Felder ergänzen" });
		knopf.addEventListener("click", () => void this.nachtragen(nachtragen, nachtraege));
	}

	private async nachtragen(
		nachtragen: Nachtragen,
		nachtraege: ReturnType<Nachtragen["suchen"]>,
	): Promise<void> {
		const ja = await new BestaetigenModal(
			this.app,
			"Felder ergänzen?",
			`${nachtraege.length} Notizen bekommen die fehlenden Felder leer hinzugefügt ` +
				`(${nachAgeordnet(nachtraege)}). Vorhandene Werte und Prosa bleiben unangetastet.`,
			"Ergänzen",
		).frage();
		if (!ja) return;

		try {
			const gezaehlt = await nachtragen.alleNachtragen(nachtraege);
			new Notice(`${gezaehlt} Notizen ergänzt.`);
		} catch (fehler) {
			new Notice(`Das Ergänzen brach ab: ${String(fehler)}`);
		}
	}

	/**
	 * Was das Plugin nicht lesen kann, steht hier — sonst verschwände es
	 * lautlos. Ganz oben, weil eine fehlende Notiz jede Zahl darunter fragwürdig
	 * macht.
	 */
	private beanstandungenZeichnen(buehne: HTMLElement): void {
		const beanstandungen = [
			...this.daten.unbekannteNotizen(),
			...verwaisteVerweise(
				this.daten.beitraege(),
				this.daten.engagements(),
				this.daten.konferenzen(),
				this.daten.speakerNamen(),
			),
		];
		if (beanstandungen.length === 0) return;

		const kasten = buehne.createDiv({ cls: "sms-beanstandungen" });
		kasten.createDiv({
			cls: "sms-beanstandungen-kopf",
			text:
				beanstandungen.length === 1
					? "⚠ Eine Notiz wird in keiner Sicht gezeigt"
					: `⚠ ${beanstandungen.length} Notizen werden in keiner Sicht gezeigt`,
		});

		for (const beanstandung of beanstandungen) {
			const zeile = kasten.createDiv({ cls: "sms-beanstandung" });
			zeile.createSpan({ cls: "sms-umbenennen", text: beanstandung.datei.basename });
			zeile.createSpan({ text: ` — ${beanstandung.text}` });
			zeile.addEventListener("click", () => this.notizOeffnen(beanstandung.datei));
		}
	}

	private async statusSetzen(konferenz: Konferenz, status: string): Promise<void> {
		try {
			await this.schreiber.konferenzstatusSetzen(konferenz.datei, status);
			if (istArchiv({ ...konferenz, status })) {
				new Notice(`${konferenz.name} ist jetzt Archiv — die Agenda lässt sich nicht mehr ändern.`);
			}
		} catch (fehler) {
			new Notice(`Der Status ließ sich nicht setzen: ${String(fehler)}`);
		}
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

		if (karte.reisekosten > 0) {
			zahlen.createSpan({ text: `${euro(karte.reisekosten)} Reisekosten` });
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

		// Der Status ist kein Etikett, sondern eine Entscheidung: Er sperrt die
		// Agenda, sobald die Konferenz gelaufen ist. Deshalb steht er in einer
		// eigenen Zeile zum Ändern und nicht als Plakette am Rand.
		const statuszeile = kasten.createDiv({ cls: "sms-statuszeile" });
		statuszeile.createSpan({ cls: "sms-statustitel", text: "Status" });

		const auswahl = statuszeile.createEl("select", {
			cls: `dropdown sms-statuswahl sms-status-${konferenz.status ?? "idee"}`,
		});
		for (const wert of KONFERENZSTATUS) {
			const eintrag = auswahl.createEl("option", {
				text: KONFERENZSTATUS_TITEL[wert],
				value: wert,
			});
			if (wert === (konferenz.status ?? "idee")) eintrag.selected = true;
		}
		auswahl.addEventListener("click", (ereignis) => ereignis.stopPropagation());
		auswahl.addEventListener("change", () => {
			void this.statusSetzen(konferenz, auswahl.value);
		});

		const notiz = statuszeile.createSpan({ cls: "sms-umbenennen", text: "Notiz öffnen" });
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
