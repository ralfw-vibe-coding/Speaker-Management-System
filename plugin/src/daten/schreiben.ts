import { App, normalizePath, TFile, TFolder } from "obsidian";
import type SmsPlugin from "../main";

/**
 * Zeichen, die Obsidian in Notiznamen verbietet. Beim Speaker ist der Name die
 * Datei — anders als beim Beitrag gibt es kein Feld, in das der ungekürzte
 * Titel ausweichen könnte. Deshalb wird abgelehnt statt bereinigt.
 */
const VERBOTENE_ZEICHEN = /[*"\\/<>:|?#^[\]]/;

/**
 * Das Plugin besitzt die Dateien: Es legt sie an, benennt sie und garantiert
 * eindeutige Namen und korrektes Frontmatter. Geschrieben wird eng — nur die
 * eigenen Felder, und nur beim Anlegen.
 */
export class Datenschreiber {
	constructor(private app: App, private plugin: SmsPlugin) {}

	/**
	 * Prüft einen Namen, bevor daraus eine Datei wird. Gibt den Grund zurück,
	 * warum er nicht geht — oder `undefined`, wenn er geht.
	 */
	nameGeprueft(name: string, vorhandene: string[]): string | undefined {
		const sauber = name.trim();
		if (sauber.length === 0) return "Der Name fehlt.";

		if (VERBOTENE_ZEICHEN.test(sauber)) {
			return "Diese Zeichen sind in Notiznamen nicht erlaubt: * \" \\ / < > : | ? # ^ [ ]";
		}

		// Groß- und Kleinschreibung ignoriert: Zwei Notizen, die sich nur darin
		// unterscheiden, wären für Obsidian dieselbe Datei.
		const treffer = vorhandene.find((v) => v.toLowerCase() === sauber.toLowerCase());
		if (treffer) return `„${treffer}“ gibt es schon.`;

		return undefined;
	}

	/**
	 * Legt eine Speakernotiz an. Die Felder bleiben leer — ausgefüllt wird in
	 * der Notiz, nicht im Formular. `wahl` fehlt bewusst: Sie entsteht erst,
	 * wenn man sich zu einem Thema festgelegt hat.
	 */
	async speakerAnlegen(name: string): Promise<TFile> {
		const ordner = this.plugin.settings.speakerOrdner;
		await this.ordnerSicherstellen(ordner);

		const pfad = normalizePath(`${ordner}/${name.trim()}.md`);
		const inhalt = [
			"---",
			"type: speaker",
			"rolle:",
			"email:",
			"telefon:",
			"web:",
			"themen: []",
			"formate: []",
			"sprachen: []",
			"ort:",
			"honorarrahmen:",
			"---",
			"## Profil",
			"",
			"",
			"## Notizen",
			"",
			"",
		].join("\n");

		return this.app.vault.create(pfad, inhalt);
	}

	/**
	 * Schreibt `status` und `position` in mehrere Engagements — die einzige
	 * Änderung, die das Verschieben einer Karte auslöst.
	 *
	 * `processFrontMatter` fasst genau die genannten Felder an und lässt Body
	 * und Fremdfelder unangetastet. Das ist „eng schreiben": Gesprächsnotizen,
	 * Häkchen und Felder anderer Werkzeuge überleben jeden Zug.
	 */
	async statusUndPosition(
		aenderungen: { datei: TFile; status: string; position: number }[],
	): Promise<void> {
		for (const aenderung of aenderungen) {
			await this.app.fileManager.processFrontMatter(aenderung.datei, (fm) => {
				fm.status = aenderung.status;
				fm.position = aenderung.position;
			});
		}
	}

	/**
	 * Setzt `block` und `track` eines Beitrags — das Verschieben zwischen Pool
	 * und Raster. Ein leerer Platz bedeutet Pool; das Feld verschwindet dann,
	 * statt mit einem leeren Wert dazustehen. Gelesen wird ohnehin tolerant.
	 */
	async beitraegePlatzieren(
		aenderungen: { datei: TFile; block?: string; track?: string }[],
	): Promise<void> {
		for (const aenderung of aenderungen) {
			await this.app.fileManager.processFrontMatter(aenderung.datei, (fm) => {
				if (aenderung.block) fm.block = aenderung.block;
				else delete fm.block;

				if (aenderung.track) fm.track = aenderung.track;
				else delete fm.track;
			});
		}
	}

	private async ordnerSicherstellen(ordner: string): Promise<void> {
		if (!ordner) return;
		const pfad = normalizePath(ordner);
		const vorhanden = this.app.vault.getAbstractFileByPath(pfad);
		if (vorhanden instanceof TFolder) return;
		if (vorhanden) return; // Eine Datei mit dem Namen — dann scheitert das Anlegen sprechend.
		await this.app.vault.createFolder(pfad);
	}
}
