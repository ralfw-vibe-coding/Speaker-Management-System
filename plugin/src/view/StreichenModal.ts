import { App, Modal, Setting } from "obsidian";

/** Was mit einem Beitrag geschieht, wenn sein Speaker gestrichen wird. */
export interface Streichfolge {
	titel?: string;
	ort: string;
	behalten: boolean;
}

/**
 * Streichen ist die einzige Stelle, an der das Plugin fremde Notizen anfasst —
 * und sie wird von einer Geste ausgelöst, die man auch aus Versehen macht.
 * Deshalb steht davor diese Frage, und sie zeigt jeden Beitrag einzeln.
 */
export class StreichenModal extends Modal {
	private antwort: ((ja: boolean) => void) | undefined;

	constructor(
		app: App,
		private speaker: string,
		private folgen: Streichfolge[],
	) {
		super(app);
	}

	/** Öffnet den Dialog und wartet auf die Antwort. */
	frage(): Promise<boolean> {
		return new Promise((aufloesen) => {
			this.antwort = aufloesen;
			this.open();
		});
	}

	onOpen(): void {
		this.titleEl.setText(`${this.speaker} streichen?`);

		const behalten = this.folgen.filter((folge) => folge.behalten);
		const verwerfen = this.folgen.filter((folge) => !folge.behalten);

		this.contentEl.createEl("p", {
			text:
				`Das Engagement wandert nach „gestrichen“, und ${anzahl(this.folgen.length)} ` +
				"verlieren ihren Platz. Die Slots sind danach wieder Löcher.",
		});

		if (behalten.length > 0) {
			this.contentEl.createEl("p", {
				cls: "sms-dialog-abschnitt",
				text: "Diese Themen bleiben erhalten und liegen danach ohne Speaker im Pool:",
			});
			const liste = this.contentEl.createEl("ul");
			for (const folge of behalten) {
				liste.createEl("li", { text: `„${folge.titel}“ · ${folge.ort}` });
			}
		}

		if (verwerfen.length > 0) {
			this.contentEl.createEl("p", {
				cls: "sms-dialog-abschnitt",
				text: "Diese Beiträge hatten kein Thema und wandern in den Papierkorb:",
			});
			const liste = this.contentEl.createEl("ul");
			for (const folge of verwerfen) {
				liste.createEl("li", { text: folge.ort });
			}
		}

		this.contentEl.createEl("p", {
			cls: "sms-dialog-fussnote",
			text: "Was vorgesehen war, wird als Notiz im Engagement festgehalten.",
		});

		new Setting(this.contentEl)
			.addButton((knopf) => knopf.setButtonText("Abbrechen").onClick(() => this.close()))
			.addButton((knopf) =>
				knopf
					.setButtonText("Streichen")
					.setWarning()
					.onClick(() => {
						this.antwort?.(true);
						this.antwort = undefined;
						this.close();
					}),
			);
	}

	onClose(): void {
		// Auch das Schließen über Escape ist eine Antwort — und zwar nein.
		this.antwort?.(false);
		this.antwort = undefined;
		this.contentEl.empty();
	}
}

function anzahl(wert: number): string {
	return wert === 1 ? "ein Beitrag" : `${wert} Beiträge`;
}
