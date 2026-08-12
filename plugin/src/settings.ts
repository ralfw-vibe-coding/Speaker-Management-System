import { App, PluginSettingTab, Setting } from "obsidian";
import type SmsPlugin from "./main";

export interface SmsSettings {
	/** Ordner für den Speakerkatalog. */
	speakerOrdner: string;
	/** Ordner für die Veranstalter. */
	veranstalterOrdner: string;
	/** Ordner, unter dem je Veranstaltung ein Unterordner liegt. */
	veranstaltungenOrdner: string;
}

export const DEFAULT_SETTINGS: SmsSettings = {
	speakerOrdner: "speaker",
	veranstalterOrdner: "veranstalter",
	veranstaltungenOrdner: "veranstaltungen",
};

export class SmsSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: SmsPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Speakerkatalog")
			.setDesc("Ordner mit den Speaker-Notizen.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.speakerOrdner)
					.setValue(this.plugin.settings.speakerOrdner)
					.onChange(async (value) => {
						this.plugin.settings.speakerOrdner = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Veranstalter")
			.setDesc("Ordner mit den Veranstalter-Notizen.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.veranstalterOrdner)
					.setValue(this.plugin.settings.veranstalterOrdner)
					.onChange(async (value) => {
						this.plugin.settings.veranstalterOrdner = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Veranstaltungen")
			.setDesc("Ordner, unter dem je Veranstaltung ein eigener Unterordner liegt.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.veranstaltungenOrdner)
					.setValue(this.plugin.settings.veranstaltungenOrdner)
					.onChange(async (value) => {
						this.plugin.settings.veranstaltungenOrdner = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}
}
