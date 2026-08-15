import { App, Modal, Setting } from "obsidian";
import type { Block, Track } from "../daten/modell";

/**
 * Eine Rückfrage, bevor etwas verschwindet. Antwortet mit `false`, wenn der
 * Dialog anders als über „Ja" geschlossen wird — Escape ist auch eine Antwort.
 */
export class BestaetigenModal extends Modal {
	private antwort: ((ja: boolean) => void) | undefined;

	constructor(
		app: App,
		private ueberschrift: string,
		private text: string,
		private knopftext: string,
	) {
		super(app);
	}

	frage(): Promise<boolean> {
		return new Promise((aufloesen) => {
			this.antwort = aufloesen;
			this.open();
		});
	}

	onOpen(): void {
		this.titleEl.setText(this.ueberschrift);
		this.contentEl.createEl("p", { text: this.text });

		new Setting(this.contentEl)
			.addButton((knopf) => knopf.setButtonText("Abbrechen").onClick(() => this.close()))
			.addButton((knopf) =>
				knopf
					.setButtonText(this.knopftext)
					.setWarning()
					.onClick(() => {
						this.antwort?.(true);
						this.antwort = undefined;
						this.close();
					}),
			);
	}

	onClose(): void {
		this.antwort?.(false);
		this.antwort = undefined;
		this.contentEl.empty();
	}
}

/**
 * Eine einzelne Zeile Text erfragen — für alles, was in dieser Phase schnell
 * getippt wird: eine Idee, ein Strangname, ein Name als Einfall.
 *
 * Antwortet mit `undefined`, wenn abgebrochen wurde. Ein leeres Feld ist nur
 * dann eine Antwort, wenn `leerErlaubt` gesetzt ist — dann heisst es „nimm den
 * Wert wieder heraus".
 */
export class TextModal extends Modal {
	private antwort: ((wert: string | undefined) => void) | undefined;
	private wert = "";

	constructor(
		app: App,
		private angaben: {
			titel: string;
			beschriftung: string;
			hinweis?: string;
			vorgabe?: string;
			/** Namen zur Auswahl — Obsidians Eingabefeld bekommt eine Vorschlagsliste. */
			vorschlaege?: string[];
			knopf: string;
			leerErlaubt?: boolean;
		},
	) {
		super(app);
		this.wert = angaben.vorgabe ?? "";
	}

	frage(): Promise<string | undefined> {
		return new Promise((aufloesen) => {
			this.antwort = aufloesen;
			this.open();
		});
	}

	onOpen(): void {
		this.titleEl.setText(this.angaben.titel);

		if (this.angaben.hinweis) {
			this.contentEl.createEl("p", { cls: "sms-dialog-abschnitt", text: this.angaben.hinweis });
		}

		const feld = new Setting(this.contentEl).setName(this.angaben.beschriftung).addText((eingabe) => {
			eingabe.setValue(this.wert).onChange((neuer) => {
				this.wert = neuer;
			});
			// Enter schliesst ab — man tippt hier schnell und will nicht zur Maus.
			eingabe.inputEl.addEventListener("keydown", (ereignis) => {
				if (ereignis.key === "Enter") {
					ereignis.preventDefault();
					this.abschliessen();
				}
			});
			window.setTimeout(() => eingabe.inputEl.focus(), 0);

			if (this.angaben.vorschlaege && this.angaben.vorschlaege.length > 0) {
				const liste = this.contentEl.createEl("datalist");
				liste.id = "sms-vorschlaege";
				for (const vorschlag of this.angaben.vorschlaege) {
					liste.createEl("option", { value: vorschlag });
				}
				eingabe.inputEl.setAttribute("list", liste.id);
			}
		});
		feld.settingEl.addClass("sms-dialog-zeile");

		new Setting(this.contentEl)
			.addButton((knopf) => knopf.setButtonText("Abbrechen").onClick(() => this.close()))
			.addButton((knopf) =>
				knopf.setButtonText(this.angaben.knopf).setCta().onClick(() => this.abschliessen()),
			);
	}

	private abschliessen(): void {
		const sauber = this.wert.trim();
		if (sauber.length === 0 && !this.angaben.leerErlaubt) return;
		this.antwort?.(sauber);
		this.antwort = undefined;
		this.close();
	}

	onClose(): void {
		this.antwort?.(undefined);
		this.antwort = undefined;
		this.contentEl.empty();
	}
}

/** Ein Tag ist nur ein Datum — das Raster daran hängt am Tag, nicht am Dialog. */
export class TagModal extends Modal {
	private datum: string;
	private antwort: ((datum: string | undefined) => void) | undefined;

	constructor(app: App, vorgabe = "") {
		super(app);
		this.datum = vorgabe;
	}

	frage(): Promise<string | undefined> {
		return new Promise((aufloesen) => {
			this.antwort = aufloesen;
			this.open();
		});
	}

	onOpen(): void {
		this.titleEl.setText(this.datum ? "Tag ändern" : "Tag hinzufügen");

		new Setting(this.contentEl).setName("Datum").addText((text) => {
			text.inputEl.type = "date";
			text.setValue(this.datum).onChange((wert) => {
				this.datum = wert;
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(this.contentEl)
			.addButton((knopf) => knopf.setButtonText("Abbrechen").onClick(() => this.close()))
			.addButton((knopf) =>
				knopf
					.setButtonText("Übernehmen")
					.setCta()
					.onClick(() => {
						if (!this.datum) return;
						this.antwort?.(this.datum);
						this.antwort = undefined;
						this.close();
					}),
			);
	}

	onClose(): void {
		this.antwort?.(undefined);
		this.antwort = undefined;
		this.contentEl.empty();
	}
}

/** Name, Raum und Kapazität eines Tracks. Raum und Kapazität gelten für alle seine Slots. */
export class TrackModal extends Modal {
	private name: string;
	private raum: string;
	private kapazitaet: string;
	private antwort: ((track: Omit<Track, "id"> | undefined) => void) | undefined;

	constructor(app: App, vorgabe?: Track) {
		super(app);
		this.name = vorgabe?.name ?? "";
		this.raum = vorgabe?.raum ?? "";
		this.kapazitaet = vorgabe?.kapazitaet !== undefined ? String(vorgabe.kapazitaet) : "";
	}

	frage(): Promise<Omit<Track, "id"> | undefined> {
		return new Promise((aufloesen) => {
			this.antwort = aufloesen;
			this.open();
		});
	}

	onOpen(): void {
		this.titleEl.setText(this.name ? "Track ändern" : "Track hinzufügen");

		new Setting(this.contentEl).setName("Name").addText((text) => {
			text.setPlaceholder("Hauptbühne").setValue(this.name).onChange((wert) => {
				this.name = wert;
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(this.contentEl)
			.setName("Raum")
			.setDesc("Gilt für alle Slots dieses Tracks. Optional.")
			.addText((text) =>
				text.setPlaceholder("Saal Hanse").setValue(this.raum).onChange((wert) => {
					this.raum = wert;
				}),
			);

		new Setting(this.contentEl)
			.setName("Kapazität")
			.setDesc("Wie viele Menschen passen hinein. Optional.")
			.addText((text) => {
				text.inputEl.type = "number";
				text.setValue(this.kapazitaet).onChange((wert) => {
					this.kapazitaet = wert;
				});
			});

		new Setting(this.contentEl)
			.addButton((knopf) => knopf.setButtonText("Abbrechen").onClick(() => this.close()))
			.addButton((knopf) =>
				knopf
					.setButtonText("Übernehmen")
					.setCta()
					.onClick(() => {
						if (!this.name.trim()) return;
						const zahl = Number(this.kapazitaet);
						this.antwort?.({
							name: this.name.trim(),
							raum: this.raum.trim() || undefined,
							kapazitaet: Number.isFinite(zahl) && zahl > 0 ? zahl : undefined,
						});
						this.antwort = undefined;
						this.close();
					}),
			);
	}

	onClose(): void {
		this.antwort?.(undefined);
		this.antwort = undefined;
		this.contentEl.empty();
	}
}

/** Was ein Block ist: eine Zeile mit Slots, ein plenarer Block oder ein Fixpunkt. */
type Blockart = "slots" | "plenar" | "fix";

export class BlockModal extends Modal {
	private von: string;
	private bis: string;
	private art: Blockart;
	private bezeichnung: string;
	private antwort: ((block: Omit<Block, "id"> | undefined) => void) | undefined;

	constructor(app: App, vorgabe?: Block) {
		super(app);
		this.von = vorgabe?.von ?? "09:00";
		this.bis = vorgabe?.bis ?? "09:45";
		this.art = vorgabe?.fix ? "fix" : vorgabe?.plenar ? "plenar" : "slots";
		this.bezeichnung = vorgabe?.fix ?? "";
	}

	frage(): Promise<Omit<Block, "id"> | undefined> {
		return new Promise((aufloesen) => {
			this.antwort = aufloesen;
			this.open();
		});
	}

	onOpen(): void {
		this.titleEl.setText(this.bezeichnung || this.von !== "09:00" ? "Block ändern" : "Block hinzufügen");

		new Setting(this.contentEl).setName("Von").addText((text) => {
			text.inputEl.type = "time";
			text.setValue(this.von).onChange((wert) => {
				this.von = wert;
			});
		});

		new Setting(this.contentEl).setName("Bis").addText((text) => {
			text.inputEl.type = "time";
			text.setValue(this.bis).onChange((wert) => {
				this.bis = wert;
			});
		});

		const bezeichnungsfeld = this.contentEl.createDiv();

		new Setting(this.contentEl)
			.setName("Art")
			.setDesc("Ein plenarer Block belegt alle Tracks; ein Fixpunkt hat gar keine Slots.")
			.addDropdown((auswahl) => {
				auswahl.addOption("slots", "Slots je Track");
				auswahl.addOption("plenar", "plenar — über alle Tracks");
				auswahl.addOption("fix", "Fixpunkt ohne Speaker");
				auswahl.setValue(this.art);
				auswahl.onChange((wert) => {
					this.art = wert as Blockart;
					this.bezeichnungZeigen(bezeichnungsfeld);
				});
			});

		this.bezeichnungZeigen(bezeichnungsfeld);

		new Setting(this.contentEl)
			.addButton((knopf) => knopf.setButtonText("Abbrechen").onClick(() => this.close()))
			.addButton((knopf) =>
				knopf
					.setButtonText("Übernehmen")
					.setCta()
					.onClick(() => {
						this.antwort?.({
							von: this.von || undefined,
							bis: this.bis || undefined,
							plenar: this.art === "plenar",
							fix: this.art === "fix" ? this.bezeichnung.trim() || "Pause" : undefined,
							nur: [],
						});
						this.antwort = undefined;
						this.close();
					}),
			);
	}

	private bezeichnungZeigen(behaelter: HTMLElement): void {
		behaelter.empty();
		if (this.art !== "fix") return;

		new Setting(behaelter).setName("Bezeichnung").addText((text) =>
			text
				.setPlaceholder("Mittagspause")
				.setValue(this.bezeichnung)
				.onChange((wert) => {
					this.bezeichnung = wert;
				}),
		);
	}

	onClose(): void {
		this.antwort?.(undefined);
		this.antwort = undefined;
		this.contentEl.empty();
	}
}
