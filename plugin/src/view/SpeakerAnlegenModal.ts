import { App, Modal, Setting, TFile } from "obsidian";
import type { Datenschreiber } from "../daten/schreiben";
import type { Speaker } from "../daten/modell";

/**
 * Fragt nur nach dem Namen. Alles Weitere steht danach in der Notiz, die im
 * Nachbar-Pane aufgeht — ein Formular für Bio, Themen und Honorarrahmen wäre
 * die halbe Oberfläche doppelt.
 *
 * Der Dialog prüft schon beim Tippen gegen die vorhandenen Namen: Weil der
 * Dateiname die Identität ist, spaltet ein zweiter „Petra Vahlbruch“ die
 * Historie in zwei Hälften, von denen jede vollständig aussieht.
 */
export class SpeakerAnlegenModal extends Modal {
	private name = "";
	private hinweisEl!: HTMLElement;
	private anlegenKnopf!: HTMLButtonElement;

	constructor(
		app: App,
		private schreiber: Datenschreiber,
		private vorhandene: Speaker[],
		private fertig: (datei: TFile) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText("Neuen Speaker anlegen");

		const feld = new Setting(this.contentEl).setName("Name").setDesc(
			"So heißt die Notiz, und so verlinken Engagements und Beiträge auf sie.",
		);

		feld.addText((text) => {
			text.setPlaceholder("Vor- und Nachname");
			text.onChange((wert) => {
				this.name = wert;
				this.pruefen();
			});
			text.inputEl.addEventListener("keydown", (ereignis) => {
				if (ereignis.key === "Enter") {
					ereignis.preventDefault();
					void this.anlegen();
				}
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		this.hinweisEl = this.contentEl.createDiv({ cls: "sms-dialog-hinweis" });

		new Setting(this.contentEl)
			.addButton((knopf) => knopf.setButtonText("Abbrechen").onClick(() => this.close()))
			.addButton((knopf) => {
				knopf.setButtonText("Anlegen").setCta().onClick(() => void this.anlegen());
				this.anlegenKnopf = knopf.buttonEl;
			});

		this.pruefen();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	/** Der Grund, warum es gerade nicht geht — live beim Tippen. */
	private pruefen(): string | undefined {
		const grund = this.schreiber.nameGeprueft(
			this.name,
			this.vorhandene.map((s) => s.name),
		);

		this.hinweisEl.empty();
		this.anlegenKnopf.disabled = grund !== undefined;

		// Beim leeren Feld ist noch nichts schiefgegangen — nur der Knopf ruht.
		if (grund && this.name.trim().length > 0) {
			this.hinweisEl.createSpan({ text: grund });

			const treffer = this.vorhandene.find(
				(s) => s.name.toLowerCase() === this.name.trim().toLowerCase(),
			);
			if (treffer) {
				const knopf = this.hinweisEl.createEl("button", {
					cls: "sms-chip",
					text: "Vorhandene Notiz öffnen",
				});
				knopf.addEventListener("click", () => {
					this.close();
					this.fertig(treffer.datei);
				});
			}
		}

		return grund;
	}

	private async anlegen(): Promise<void> {
		if (this.pruefen() !== undefined) return;

		try {
			const datei = await this.schreiber.speakerAnlegen(this.name);
			this.close();
			this.fertig(datei);
		} catch (fehler) {
			this.hinweisEl.empty();
			this.hinweisEl.createSpan({
				text: `Die Notiz ließ sich nicht anlegen: ${String(fehler)}`,
			});
		}
	}
}
