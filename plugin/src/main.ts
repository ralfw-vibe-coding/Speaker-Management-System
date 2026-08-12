import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, SmsSettingTab, type SmsSettings } from "./settings";
import { SmsView, VIEW_TYPE_SMS } from "./view/SmsView";

export default class SmsPlugin extends Plugin {
	settings: SmsSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_SMS, (leaf) => new SmsView(leaf, this));

		this.addRibbonIcon("users", "Speaker Management System", () => {
			void this.arbeitsplatzOeffnen();
		});

		this.addCommand({
			id: "arbeitsplatz-oeffnen",
			name: "Arbeitsplatz öffnen",
			callback: () => {
				void this.arbeitsplatzOeffnen();
			},
		});

		this.addSettingTab(new SmsSettingTab(this.app, this));
	}

	/** Öffnet den einen View – oder holt ihn nach vorn, wenn er schon offen ist. */
	async arbeitsplatzOeffnen(): Promise<void> {
		const { workspace } = this.app;

		const offen = workspace.getLeavesOfType(VIEW_TYPE_SMS);
		if (offen.length > 0) {
			await workspace.revealLeaf(offen[0]);
			return;
		}

		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_SMS, active: true });
		await workspace.revealLeaf(leaf);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
