import { debounce, ItemView, TFile, WorkspaceLeaf } from "obsidian";
import type SmsPlugin from "../main";
import { Datenzugriff } from "../daten/lesen";
import { Datenschreiber } from "../daten/schreiben";
import type { Speaker } from "../daten/modell";
import { Agenda } from "./agenda";
import { KonferenzAnlegenModal } from "./KonferenzAnlegenModal";
import { Speakerkatalog } from "./katalog";
import { Konferenzuebersicht } from "./konferenzen";
import { SpeakerAnlegenModal } from "./SpeakerAnlegenModal";
import { Statustafel } from "./statustafel";

export const VIEW_TYPE_SMS = "sms-arbeitsplatz";

/** Die Sichten, zwischen denen der eine View umschaltet. */
type Sicht = "konferenzen" | "katalog" | "statustafel" | "agenda";

const SICHTEN: { id: Sicht; titel: string }[] = [
	{ id: "konferenzen", titel: "Konferenzen" },
	{ id: "katalog", titel: "Speakerkatalog" },
	{ id: "statustafel", titel: "Statustafel" },
	{ id: "agenda", titel: "Agenda" },
];

/**
 * Der eine Arbeitsplatz des Plugins. Er hält den gesamten Zustand der
 * Bedienung — welche Sicht, welche Konferenz — und rendert darin die
 * jeweilige Sicht.
 */
export class SmsView extends ItemView {
	private sicht: Sicht = "konferenzen";
	/** Die Konferenz, die gerade dran ist. Alle Sichten teilen sie sich. */
	private konferenzName: string | null = null;

	private daten: Datenzugriff;
	private schreiber: Datenschreiber;
	private uebersicht: Konferenzuebersicht;
	private katalog: Speakerkatalog;
	private statustafel: Statustafel;
	private agenda: Agenda;

	constructor(leaf: WorkspaceLeaf, private plugin: SmsPlugin) {
		super(leaf);
		// Bewusst plugin.app statt this.app: Das Plugin hat die App sicher,
		// die Basisklasse setzt ihr Feld erst im Verlauf des Konstruktors.
		this.daten = new Datenzugriff(plugin.app, plugin);
		this.schreiber = new Datenschreiber(plugin.app, plugin);

		const oeffnen = (datei: TFile) => void this.notizOeffnen(datei);

		this.uebersicht = new Konferenzuebersicht(
			plugin.app,
			this.daten,
			this.schreiber,
			oeffnen,
			(name) => {
				// Eine Konferenz auszuwählen heißt: ab jetzt arbeite ich an der.
				this.konferenzName = name;
				this.sicht = "statustafel";
				void this.render();
			},
			(vorhandene) => this.konferenzAnlegen(vorhandene),
		);
		this.katalog = new Speakerkatalog(this.daten, this.schreiber, oeffnen, (vorhandene) =>
			this.speakerAnlegen(vorhandene),
		);
		this.statustafel = new Statustafel(plugin.app, this.daten, this.schreiber, oeffnen);
		this.agenda = new Agenda(plugin.app, this.daten, this.schreiber, oeffnen);
	}

	private konferenzAnlegen(vorhandene: string[]): void {
		new KonferenzAnlegenModal(
			this.app,
			this.schreiber,
			vorhandene,
			this.daten.veranstalter().map((v) => v.name),
			(datei) => {
				// Die neue Konferenz ist ab sofort die, an der gearbeitet wird.
				this.konferenzName = datei.basename;
				void this.notizOeffnen(datei);
				void this.render();
			},
		).open();
	}

	/** Der Dialog fragt nur nach dem Namen; gefüllt wird danach in der Notiz. */
	private speakerAnlegen(vorhandene: Speaker[]): void {
		new SpeakerAnlegenModal(this.app, this.schreiber, vorhandene, (datei) =>
			void this.notizOeffnen(datei),
		).open();
	}

	getViewType(): string {
		return VIEW_TYPE_SMS;
	}

	getDisplayText(): string {
		return "SpeaCon";
	}

	getIcon(): string {
		return "users";
	}

	async onOpen(): Promise<void> {
		// Die Sichten sind Projektionen: Ändert sich eine Notiz, wird neu
		// gerechnet. Das gilt auch, wenn von Hand editiert wird.
		const neuZeichnen = debounce(() => void this.render(), 150, true);
		this.registerEvent(this.app.metadataCache.on("changed", neuZeichnen));
		this.registerEvent(this.app.vault.on("create", neuZeichnen));
		this.registerEvent(this.app.vault.on("delete", neuZeichnen));
		this.registerEvent(this.app.vault.on("rename", neuZeichnen));

		await this.render();
	}

	private async render(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass("sms-view");

		const konferenzen = this.daten.konferenzen();
		if (!konferenzen.some((k) => k.name === this.konferenzName)) {
			// Beim ersten Zeichnen und nach einem Umbenennen: die jüngste nehmen.
			this.konferenzName = konferenzen[0]?.name ?? null;
		}

		const kopf = root.createDiv({ cls: "sms-kopf" });

		// Die Version steht sichtbar im Kopf, damit man nach einem Pull erkennt,
		// ob der eigene Build schon der neue ist. Sie ist beim Bauen ins Bundle
		// eingesetzt — siehe globals.d.ts.
		const titelzeile = kopf.createDiv({ cls: "sms-titelzeile" });
		titelzeile.createEl("h2", { text: "SpeaCon", cls: "sms-titel" });
		titelzeile.createEl("span", { text: `v${__SMS_VERSION__}`, cls: "sms-version" });

		const auswahl = titelzeile.createEl("select", { cls: "sms-konferenzwahl dropdown" });
		for (const konferenz of konferenzen) {
			const eintrag = auswahl.createEl("option", {
				text: konferenz.name,
				value: konferenz.name,
			});
			if (konferenz.name === this.konferenzName) eintrag.selected = true;
		}
		if (konferenzen.length === 0) {
			auswahl.createEl("option", { text: "keine Konferenz", value: "" });
		}
		auswahl.addEventListener("change", () => {
			this.konferenzName = auswahl.value;
			void this.render();
		});

		// Zwei- bis sechsmal im Jahr braucht man das — dafür lohnt kein eigener
		// Reiter, wohl aber ein Knopf da, wo man ohnehin hinschaut.
		const neu = titelzeile.createEl("button", {
			cls: "sms-neue-konferenz",
			text: "＋",
			attr: { title: "Neue Konferenz anlegen" },
		});
		neu.addEventListener("click", () => this.konferenzAnlegen(konferenzen.map((k) => k.name)));

		// Jeder Bereich trägt seine eigene Farbe. Die Klasse steht am Reiter *und*
		// an der Bühne, damit das Stylesheet die Farbe auch in der Ansicht
		// aufnehmen kann — und zwar über einen Namen statt über die Position.
		const reiter = kopf.createDiv({ cls: "sms-reiter" });
		for (const { id, titel } of SICHTEN) {
			const knopf = reiter.createEl("button", {
				text: titel,
				cls: `sms-reiter-knopf sms-bereich-${id}${id === this.sicht ? " is-active" : ""}`,
			});
			knopf.addEventListener("click", () => {
				this.sicht = id;
				void this.render();
			});
		}

		const buehne = root.createDiv({ cls: `sms-buehne sms-bereich-${this.sicht}` });

		const konferenz = konferenzen.find((k) => k.name === this.konferenzName);

		if (this.sicht === "konferenzen") {
			this.uebersicht.zeichnen(buehne);
			return;
		}

		if (this.sicht === "katalog") {
			await this.katalog.zeichnen(buehne, konferenz);
			return;
		}

		if (this.sicht === "statustafel") {
			await this.statustafel.zeichnen(buehne, konferenz);
			return;
		}

		await this.agenda.zeichnen(buehne, konferenz);
	}

	/**
	 * Details stehen in der Notiz, nicht im Formular: Ein Klick öffnet sie im
	 * Nachbar-Pane. Gibt es keinen, wird einer aufgeklappt.
	 */
	private async notizOeffnen(datei: TFile): Promise<void> {
		const nachbarn = this.app.workspace
			.getLeavesOfType("markdown")
			.filter((blatt) => blatt !== this.leaf);

		const ziel = nachbarn[0] ?? this.app.workspace.getLeaf("split");
		await ziel.openFile(datei);
		void this.app.workspace.revealLeaf(ziel);
	}
}
