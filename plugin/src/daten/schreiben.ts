import { App, normalizePath, TFile, TFolder } from "obsidian";
import type SmsPlugin from "../main";
import type { Block, Konferenz, Tag, Track } from "./modell";

/** Die Unterordner je Konferenz. Stehen so im Konzept und sind nicht konfigurierbar. */
const BEITRAGSORDNER = "beiträge";
const ENGAGEMENTORDNER = "engagements";

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

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

	/**
	 * Legt einen Beitrag an, weil ein Kandidat in einen Slot gezogen wurde.
	 * Er entsteht titellos — der Speaker steht, das Thema kommt später — und
	 * heißt deshalb vorläufig nach seinem Platz. Sobald ein Titel da ist, wird
	 * die Notiz umbenannt; Obsidian zieht die Links dabei mit.
	 */
	async beitragAnlegen(ziel: {
		konferenz: Konferenz;
		speaker: string;
		tag: Tag;
		block: Block;
		track?: Track;
	}): Promise<TFile> {
		const ordner = `${ziel.konferenz.datei.parent?.path ?? ""}/${BEITRAGSORDNER}`;
		await this.ordnerSicherstellen(ordner);

		const name = await this.freierName(ordner, vorlaeufigerName(ziel));
		const pfad = normalizePath(`${ordner}/${name}.md`);

		const zeilen = [
			"---",
			"type: beitrag",
			`konferenz: "[[${ziel.konferenz.name}]]"`,
			`speaker: ["[[${ziel.speaker}]]"]`,
			"titel:",
			"format:",
			"max_teilnehmer:",
			`block: ${ziel.block.id}`,
			ziel.track ? `track: ${ziel.track.id}` : "track:",
			"---",
			"## Zu klären",
			"- [ ] Abstract eingereicht",
			"- [ ] Folien eingereicht",
			"- [ ] Technikbedarf geklärt",
			"",
			"## Abstract",
			"",
			"",
			"## Für den Speaker",
			"",
			"",
		];

		return this.app.vault.create(pfad, zeilen.join("\n"));
	}

	/**
	 * Legt Konferenz und, falls nötig, ihren Veranstalter an. Gefragt wird nur
	 * nach dem Nötigsten; Ausrichtung, Konditionen und Gesprächsnotizen stehen
	 * danach in den Notizen, nicht in einem Formular.
	 *
	 * Das Raster bekommt einen Anfang — ein Tag, ein Track, drei Blöcke —,
	 * damit die Agenda etwas zu zeigen hat. Weitergebaut wird dort.
	 */
	async konferenzAnlegen(angaben: {
		name: string;
		untertitel?: string;
		veranstalter: string;
		veranstalterIstNeu: boolean;
		datum?: string;
		honorarbudget?: number;
	}): Promise<TFile> {
		if (angaben.veranstalterIstNeu) await this.veranstalterAnlegen(angaben.veranstalter);

		const ordner = `${this.plugin.settings.konferenzenOrdner}/${angaben.name}`;
		await this.ordnerSicherstellen(ordner);

		const zeilen = [
			"---",
			"type: konferenz",
			`untertitel: ${angaben.untertitel ?? ""}`,
			`veranstalter: "[[${angaben.veranstalter}]]"`,
			// Ohne Termin ist es noch keine Planung, sondern eine Idee.
			`status: ${angaben.datum ? "planung" : "idee"}`,
			"deadline_programm:",
			`honorarbudget: ${angaben.honorarbudget ?? ""}`,
		];

		if (angaben.datum) {
			zeilen.push(
				"tracks:",
				"  - { id: t1, name: Hauptbühne }",
				"tage:",
				`  - datum: ${angaben.datum}`,
				"    tracks: [t1]",
				"    bloecke:",
				'      - { id: b1, von: "09:00", bis: "09:45" }',
				'      - { id: b2, von: "09:45", bis: "10:00", fix: Pause }',
				'      - { id: b3, von: "10:00", bis: "10:45" }',
			);
		}

		zeilen.push(
			"---",
			"## Ausrichtung",
			"",
			"",
			"## Mit dem Veranstalter zu klären",
			"- [ ] Honorarbudget bestätigt",
			"- [ ] Anzahl Tracks und Slots final",
			"- [ ] Reisekosten-Regelung",
			"- [ ] Wer schließt die Verträge?",
			"",
			"## Notizen",
			"",
			"",
		);

		return this.app.vault.create(
			normalizePath(`${ordner}/${angaben.name}.md`),
			zeilen.join("\n"),
		);
	}

	private async veranstalterAnlegen(name: string): Promise<TFile> {
		const ordner = this.plugin.settings.veranstalterOrdner;
		await this.ordnerSicherstellen(ordner);

		const zeilen = [
			"---",
			"type: veranstalter",
			"ansprechpartner:",
			"email:",
			"telefon:",
			"---",
			"## Konditionen",
			"",
			"",
			"## Notizen",
			"",
			"",
		];

		return this.app.vault.create(normalizePath(`${ordner}/${name}.md`), zeilen.join("\n"));
	}

	/**
	 * Streichen: Der Speaker fällt aus, seine Slots werden wieder Löcher.
	 *
	 * Ein Beitrag **mit** Titel behält sein Thema und landet ohne Speaker und
	 * ohne Platz im Pool — daran hat jemand gearbeitet, und „Thema steht,
	 * Speaker offen" ist ein vorgesehener Zustand. Ein Beitrag **ohne** Titel
	 * trug nichts als den Namen des Speakers und wandert in den Papierkorb,
	 * nicht in den Abgrund: Obsidian legt ihn im Vault ab, er ist zurückholbar.
	 */
	async beitraegeStreichen(beitraege: { datei: TFile; titel?: string }[]): Promise<void> {
		for (const beitrag of beitraege) {
			if (beitrag.titel) {
				await this.app.fileManager.processFrontMatter(beitrag.datei, (fm) => {
					fm.speaker = [];
					delete fm.block;
					delete fm.track;
				});
			} else {
				await this.app.vault.trash(beitrag.datei, false);
			}
		}
	}

	/**
	 * Hängt ans Ende des Engagements, was vorgesehen war. Der Body wird nur
	 * ergänzt, nichts Vorhandenes angefasst — die Spur soll bleiben, wenn der
	 * Beitrag weg ist.
	 */
	async spurAnhaengen(datei: TFile, absatz: string): Promise<void> {
		const inhalt = await this.app.vault.read(datei);
		const getrennt = inhalt.endsWith("\n") ? "" : "\n";
		await this.app.vault.modify(datei, `${inhalt}${getrennt}\n${absatz}\n`);
	}

	/**
	 * Legt ein Engagement an: Der Speaker wird Kandidat für diese Konferenz.
	 * Es entsteht im Status `gemerkt` und hängt sich hinten an die Spalte —
	 * eine aufgebaute Ordnung soll nicht von oben zerdrückt werden.
	 */
	async engagementAnlegen(
		konferenz: Konferenz,
		speaker: string,
		position: number,
	): Promise<TFile> {
		const ordner = `${konferenz.datei.parent?.path ?? ""}/${ENGAGEMENTORDNER}`;
		await this.ordnerSicherstellen(ordner);

		const name = await this.freierName(ordner, ohneVerbotene(`${konferenz.name} – ${speaker}`));
		const pfad = normalizePath(`${ordner}/${name}.md`);

		const zeilen = [
			"---",
			"type: engagement",
			`konferenz: "[[${konferenz.name}]]"`,
			`speaker: "[[${speaker}]]"`,
			"status: gemerkt",
			`position: ${position}`,
			"honorar:",
			"angefragt_am:",
			"geantwortet_am:",
			"rechnung_am:",
			"bezahlt_am:",
			"bewertung:",
			"---",
			"## Zu klären",
			"- [ ] Bio erhalten",
			"- [ ] Foto erhalten",
			"- [ ] Vertrag zurück",
			"- [ ] Reisekosten geklärt",
			"",
			"## Gesprächsnotizen",
			"",
			"",
		];

		return this.app.vault.create(pfad, zeilen.join("\n"));
	}

	/**
	 * Benennt einen Beitrag nach seinem Titel. Obsidian zieht die Links dabei
	 * mit; angefasst wird nur, wer noch seinen Platzhalternamen trägt.
	 */
	async beitragUmbenennen(datei: TFile, konferenz: Konferenz, titel: string): Promise<void> {
		const ordner = datei.parent?.path ?? "";
		const wunsch = ohneVerbotene(`${konferenz.name} – ${titel}`);
		if (wunsch === datei.basename) return;

		const name = await this.freierName(ordner, wunsch);
		await this.app.fileManager.renameFile(datei, normalizePath(`${ordner}/${name}.md`));
	}

	/** Benennt einen titellosen Beitrag nach seinem neuen Platz. */
	async platzhalterNachziehen(
		datei: TFile,
		ziel: { konferenz: Konferenz; tag: Tag; block: Block; track?: Track },
	): Promise<void> {
		const ordner = datei.parent?.path ?? "";
		const wunsch = vorlaeufigerName(ziel);
		if (wunsch === datei.basename) return;

		const name = await this.freierName(ordner, wunsch);
		await this.app.fileManager.renameFile(datei, normalizePath(`${ordner}/${name}.md`));
	}

	/** Hängt eine Zahl an, falls der Name schon vergeben ist. */
	private async freierName(ordner: string, wunsch: string): Promise<string> {
		let name = wunsch;
		let zaehler = 2;
		while (this.app.vault.getAbstractFileByPath(normalizePath(`${ordner}/${name}.md`))) {
			name = `${wunsch} ${zaehler++}`;
		}
		return name;
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

/**
 * `Assistenz Summit 2026 – Beitrag Mi 12 Uhr Werkzeuge & KI` — der Konferenzname
 * als Präfix, damit die Notiz vault-weit eindeutig heißt und die Backlink-Liste
 * am Speaker seine Historie ergibt.
 */
function vorlaeufigerName(ziel: {
	konferenz: Konferenz;
	tag: Tag;
	block: Block;
	track?: Track;
}): string {
	const teile = ["Beitrag"];

	const wochentag = ziel.tag.datum ? WOCHENTAGE[new Date(ziel.tag.datum).getDay()] : undefined;
	if (wochentag) teile.push(wochentag);

	if (ziel.block.von) teile.push(`${ziel.block.von.split(":")[0]} Uhr`);
	teile.push(ziel.track ? ziel.track.name : "plenar");

	return ohneVerbotene(`${ziel.konferenz.name} – ${teile.join(" ")}`);
}

/** Beim Beitrag wird bereinigt statt abgelehnt: Der Titel steht im Feld `titel`. */
function ohneVerbotene(name: string): string {
	return name.replace(new RegExp(VERBOTENE_ZEICHEN.source, "g"), "").trim();
}

/**
 * Trägt die Notiz noch den Namen, den das Plugin ihr beim Anlegen gegeben hat?
 * Nur dann wird umbenannt — wer eine Beitragsnotiz einmal selbst benannt hat,
 * soll nicht später überstimmt werden.
 */
export function istPlatzhalterName(dateiname: string, konferenzName: string): boolean {
	return dateiname.startsWith(`${konferenzName} – Beitrag `);
}
