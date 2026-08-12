import { ItemView, WorkspaceLeaf } from "obsidian";
import type SmsPlugin from "../main";

export const VIEW_TYPE_SMS = "sms-arbeitsplatz";

/** Die Sichten, zwischen denen der eine View umschaltet. */
type Sicht = "katalog" | "statustafel" | "agenda";

const SICHTEN: { id: Sicht; titel: string }[] = [
	{ id: "katalog", titel: "Speakerkatalog" },
	{ id: "statustafel", titel: "Statustafel" },
	{ id: "agenda", titel: "Agenda" },
];

/**
 * Der eine Arbeitsplatz des Plugins. Er hält den gesamten Zustand der
 * Bedienung (welche Konferenz, welche Sicht) und rendert darin die
 * jeweilige Sicht.
 */
export class SmsView extends ItemView {
	private sicht: Sicht = "statustafel";

	constructor(leaf: WorkspaceLeaf, private plugin: SmsPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_SMS;
	}

	getDisplayText(): string {
		return "Speaker Management";
	}

	getIcon(): string {
		return "users";
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	private render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass("sms-view");

		const kopf = root.createDiv({ cls: "sms-kopf" });
		kopf.createEl("h2", { text: "Speaker Management System", cls: "sms-titel" });

		const reiter = kopf.createDiv({ cls: "sms-reiter" });
		for (const { id, titel } of SICHTEN) {
			const knopf = reiter.createEl("button", {
				text: titel,
				cls: id === this.sicht ? "sms-reiter-knopf is-active" : "sms-reiter-knopf",
			});
			knopf.addEventListener("click", () => {
				this.sicht = id;
				this.render();
			});
		}

		const buehne = root.createDiv({ cls: "sms-buehne" });
		buehne.createEl("p", {
			text: `Hier entsteht die Sicht „${SICHTEN.find((s) => s.id === this.sicht)?.titel}".`,
			cls: "sms-platzhalter",
		});
		buehne.createEl("p", {
			text: `Speakerordner: ${this.plugin.settings.speakerOrdner}`,
			cls: "sms-platzhalter",
		});
	}
}
