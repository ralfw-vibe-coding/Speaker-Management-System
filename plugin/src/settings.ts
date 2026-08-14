import { App, PluginSettingTab, Setting } from "obsidian";
import type SmsPlugin from "./main";

export interface SmsSettings {
	/** Ordner für den Speakerkatalog. */
	speakerOrdner: string;
	/** Ordner für die Veranstalter. */
	veranstalterOrdner: string;
	/** Ordner, unter dem je Konferenz ein Unterordner liegt. */
	konferenzenOrdner: string;
	/**
	 * Plugin-Version, deren Claude-Dokumentation zuletzt in den Vault
	 * geschrieben wurde. Leer heißt: noch nie.
	 */
	dokuVersion?: string;
}

export const DEFAULT_SETTINGS: SmsSettings = {
	speakerOrdner: "speaker",
	veranstalterOrdner: "veranstalter",
	konferenzenOrdner: "konferenzen",
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
			.setName("Konferenzen")
			.setDesc("Ordner, unter dem je Konferenz ein eigener Unterordner liegt.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.konferenzenOrdner)
					.setValue(this.plugin.settings.konferenzenOrdner)
					.onChange(async (value) => {
						this.plugin.settings.konferenzenOrdner = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}
}
