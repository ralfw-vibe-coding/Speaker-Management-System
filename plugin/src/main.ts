import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, SmsSettingTab, type SmsSettings } from "./settings";
import { dokuSchreiben } from "./vaultdoku";
import { SmsView, VIEW_TYPE_SMS } from "./view/SmsView";
import { Datenzugriff } from "./daten/lesen";
import { nachAgeordnet, Nachtragen } from "./daten/migration";

export default class SmsPlugin extends Plugin {
	settings: SmsSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_SMS, (leaf) => new SmsView(leaf, this));

		this.addRibbonIcon("users", "SpeaCon", () => {
			void this.arbeitsplatzOeffnen();
		});

		this.addCommand({
			id: "arbeitsplatz-oeffnen",
			name: "Arbeitsplatz öffnen",
			callback: () => {
				void this.arbeitsplatzOeffnen();
			},
		});

		this.addCommand({
			id: "claude-doku-schreiben",
			name: "Claude-Dokumentation in diesen Vault schreiben",
			callback: () => {
				void this.claudeDokuSchreiben();
			},
		});

		// Derselbe Vorgang wie das Band in der Übersicht — für den Fall, dass man
		// ihn sucht, statt ihn angeboten zu bekommen.
		this.addCommand({
			id: "felder-ergaenzen",
			name: "Fehlende Felder in allen Notizen ergänzen",
			callback: () => {
				void this.felderErgaenzen();
			},
		});

		this.addSettingTab(new SmsSettingTab(this.app, this));

		// Nach dem Laden, nicht währenddessen: Ein frisch über BRAT installiertes
		// Plugin soll die Doku mitbringen, aber der Start darf nicht daran hängen.
		this.app.workspace.onLayoutReady(() => {
			void this.dokuAbgleichen();
		});
	}

	/**
	 * Legt die Claude-Dokumentation an, wenn sie fehlt oder von einer älteren
	 * Version stammt. Läuft still — wer sie sehen will, ruft den Befehl.
	 */
	private async dokuAbgleichen(): Promise<void> {
		if (this.settings.dokuVersion === __SMS_VERSION__) return;
		try {
			await dokuSchreiben(this.app);
			this.settings.dokuVersion = __SMS_VERSION__;
			await this.saveSettings();
		} catch (fehler) {
			console.error("SMS: Claude-Dokumentation konnte nicht geschrieben werden", fehler);
		}
	}

	/** Derselbe Vorgang von Hand — und dann auch über eine vorhandene CLAUDE.md. */
	private async claudeDokuSchreiben(): Promise<void> {
		try {
			const { geschrieben, uebersprungen } = await dokuSchreiben(this.app, true);
			this.settings.dokuVersion = __SMS_VERSION__;
			await this.saveSettings();
			new Notice(
				`Claude-Dokumentation geschrieben:\n${geschrieben.join("\n")}` +
					(uebersprungen.length > 0 ? `\n\nUnberührt: ${uebersprungen.join(", ")}` : ""),
			);
		} catch (fehler) {
			console.error(fehler);
			new Notice("Claude-Dokumentation konnte nicht geschrieben werden — siehe Konsole.");
		}
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

	/**
	 * Ergänzt in allen verwalteten Notizen die Felder, die eine ältere Version
	 * noch nicht kannte — leer, ohne Vorhandenes anzufassen. Läuft nur auf
	 * Aufruf: Nach einem Update ungefragt in fremde Dateien zu schreiben wäre
	 * das Letzte, was man will.
	 */
	async felderErgaenzen(): Promise<void> {
		const daten = new Datenzugriff(this.app, this);
		const nachtragen = new Nachtragen(this.app);
		const nachtraege = nachtragen.suchen(daten.verwalteteNotizen());

		if (nachtraege.length === 0) {
			new Notice("Alle Notizen sind auf dem Stand des Plugins.");
			return;
		}

		try {
			const gezaehlt = await nachtragen.alleNachtragen(nachtraege);
			new Notice(`${gezaehlt} Notizen ergänzt: ${nachAgeordnet(nachtraege)}.`);
		} catch (fehler) {
			new Notice(`Das Ergänzen brach ab: ${String(fehler)}`);
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
