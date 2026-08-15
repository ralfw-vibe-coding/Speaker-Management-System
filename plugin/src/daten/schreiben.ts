import { App, normalizePath, TFile, TFolder } from "obsidian";
import type SmsPlugin from "../main";
import type { Block, Konferenz, Strang, Tag, Track } from "./modell";
import {
	BEITRAGSORDNER,
	ENGAGEMENTORDNER,
	HOECHSTENS_TAGE,
	istPlatzhalterName,
	ohneVerbotene,
	tageZwischen,
	vorlaeufigerName,
	VERBOTENE_ZEICHEN,
} from "./namen";
import { geruest, schemaFuer } from "./schema";


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
		const inhalt = geruest(schemaFuer("speaker")!);

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
		aenderungen: { datei: TFile; bloecke?: string[]; track?: string }[],
	): Promise<void> {
		for (const aenderung of aenderungen) {
			await this.app.fileManager.processFrontMatter(aenderung.datei, (fm) => {
				const bloecke = aenderung.bloecke ?? [];
				// Ein einzelner Block bleibt ein einzelner Wert — die Liste ist
				// für den langen Workshop da, nicht für den Normalfall.
				if (bloecke.length === 1) fm.block = bloecke[0];
				else if (bloecke.length > 1) fm.block = bloecke;
				else delete fm.block;

				if (aenderung.track) fm.track = aenderung.track;
				else delete fm.track;
			});
		}
	}

	/**
	 * Setzt eine einzelne Zahl in einer Notiz — die Werte, die man im Gespräch
	 * oder im Rückblick nachträgt. Ohne Wert verschwindet das Feld: Leer heißt
	 * „noch nicht vereinbart", und ein gelöschter Schlüssel sagt das deutlicher
	 * als eine Null, die wie ein vereinbarter Betrag von 0 € aussähe.
	 */
	async zahlSetzen(
		datei: TFile,
		feld: "honorar" | "reisekosten" | "bewertung" | "max_teilnehmer",
		wert: number | undefined,
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(datei, (fm) => {
			if (wert === undefined) delete fm[feld];
			else fm[feld] = wert;
		});
	}

	/**
	 * Hängt eine Idee an einen Strang — oder nimmt sie heraus. Anders als beim
	 * Verschieben im Raster passiert dabei sonst nichts: Ein Strang ist eine
	 * Denkfigur, kein Platz im Programm.
	 */
	async strangSetzen(datei: TFile, strang: string | undefined): Promise<void> {
		await this.app.fileManager.processFrontMatter(datei, (fm) => {
			if (strang === undefined) delete fm.strang;
			else fm.strang = strang;
		});
	}

	/**
	 * Verwerfen heisst aufheben, nicht löschen: Die Notiz bleibt mitsamt ihrem
	 * Strang, verschwindet aber aus Pool, Raster und Statustafel. Beim Planen
	 * des nächsten Jahres schaut man dort hinein.
	 */
	async verwerfen(datei: TFile, verworfen: boolean): Promise<void> {
		const heute = new Date().toISOString().slice(0, 10);
		await this.app.fileManager.processFrontMatter(datei, (fm) => {
			if (verworfen) fm.verworfen_am = heute;
			else delete fm.verworfen_am;
		});
	}

	/** Die Stränge einer Konferenz — dieselbe Sorte Schreibvorgang wie das Raster. */
	async straengeSchreiben(konferenz: Konferenz, straenge: Strang[]): Promise<void> {
		await this.app.fileManager.processFrontMatter(konferenz.datei, (fm) => {
			if (straenge.length === 0) delete fm.straenge;
			else fm.straenge = straenge.map((strang) => ({ id: strang.id, name: strang.name }));
		});
	}

	/**
	 * Eine Idee entsteht als Beitragsnotiz mit Titel und Strang, sonst nichts.
	 * Kein Speaker, kein Block — genau das macht sie zur Idee.
	 */
	async ideeAnlegen(konferenz: Konferenz, titel: string, strang?: string): Promise<TFile> {
		const ordner = `${konferenz.datei.parent?.path ?? ""}/${BEITRAGSORDNER}`;
		await this.ordnerSicherstellen(ordner);

		const name = await this.freierName(ordner, `${konferenz.name} – ${ohneVerbotene(titel)}`);

		return this.app.vault.create(
			`${ordner}/${name}.md`,
			geruest(schemaFuer("beitrag")!, {
				konferenz: `"[[${konferenz.name}]]"`,
				titel: `"${titel.replace(/"/g, "'")}"`,
				...(strang ? { strang } : {}),
			}),
		);
	}

	/**
	 * Schaltet eine Rolle an oder aus. Sie ist eine Liste, auch wenn es bisher
	 * nur die Moderation gibt — Begrüßung und Schlusswort wären dieselbe Sorte
	 * Angabe, und ein Wahrheitswert ließe sich nie erweitern.
	 */
	async rolleUmschalten(datei: TFile, rolle: string): Promise<void> {
		await this.app.fileManager.processFrontMatter(datei, (fm) => {
			const bisher: string[] = Array.isArray(fm.rollen) ? fm.rollen.map((r: unknown) => String(r)) : [];
			const drin = bisher.some((eigene) => eigene.trim().toLowerCase() === rolle);
			const neu = drin
				? bisher.filter((eigene) => eigene.trim().toLowerCase() !== rolle)
				: [...bisher, rolle];

			// Leer gelassen heißt „keine Rolle" — dann soll auch nichts dastehen.
			if (neu.length === 0) delete fm.rollen;
			else fm.rollen = neu;
		});
	}

	/**
	 * Setzt den Status einer Konferenz. Er entscheidet über mehr als eine
	 * Beschriftung: Bei `gelaufen` und `abgesagt` ist die Agenda Archiv, und
	 * ohne diesen Weg käme eine Konferenz nie dorthin, ohne dass jemand ins
	 * Frontmatter greift.
	 */
	async konferenzstatusSetzen(datei: TFile, status: string): Promise<void> {
		await this.app.fileManager.processFrontMatter(datei, (fm) => {
			fm.status = status;
		});
	}

	/**
	 * Setzt die Wahl eines Speakers zu einem Thema. `undefined` heißt „nicht
	 * eingeschätzt" — dann verschwindet der Eintrag, statt als Null dazustehen;
	 * und ist keiner mehr übrig, verschwindet auch das Feld.
	 */
	async wahlSetzen(datei: TFile, thema: string, stufe: number | undefined): Promise<void> {
		await this.app.fileManager.processFrontMatter(datei, (fm) => {
			const wahl: Record<string, unknown> =
				fm.wahl && typeof fm.wahl === "object" && !Array.isArray(fm.wahl) ? { ...fm.wahl } : {};

			if (stufe === undefined) delete wahl[thema];
			else wahl[thema] = stufe;

			if (Object.keys(wahl).length === 0) delete fm.wahl;
			else fm.wahl = wahl;
		});
	}

	/**
	 * Setzt den Speaker eines Beitrags, der bisher keinen hatte — die zweite
	 * Richtung beim Füllen eines Slots: erst das Thema, dann der Mensch.
	 */
	async speakerZuweisen(datei: TFile, speaker: string): Promise<void> {
		await this.app.fileManager.processFrontMatter(datei, (fm) => {
			fm.speaker = [`[[${speaker}]]`];
		});
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

		return this.app.vault.create(
			normalizePath(`${ordner}/${name}.md`),
			geruest(schemaFuer("beitrag")!, {
				konferenz: `"[[${ziel.konferenz.name}]]"`,
				speaker: `["[[${ziel.speaker}]]"]`,
				block: ziel.block.id,
				...(ziel.track ? { track: ziel.track.id } : {}),
			}),
		);
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
		datumVon?: string;
		datumBis?: string;
		honorarbudget?: number;
	}): Promise<TFile> {
		if (angaben.veranstalterIstNeu) await this.veranstalterAnlegen(angaben.veranstalter);

		const ordner = `${this.plugin.settings.konferenzenOrdner}/${angaben.name}`;
		await this.ordnerSicherstellen(ordner);

		const tage = tageZwischen(angaben.datumVon, angaben.datumBis);

		// Das Raster steht als verschachteltes YAML unter den flachen Feldern —
		// deshalb als Zusatz und nicht als Vorgabe.
		const raster: string[] = [];
		if (tage.length > 0) {
			raster.push("tracks:", "  - { id: t1, name: Hauptbühne }", "tage:");

			// Block-IDs sind konferenzweit eindeutig, also über alle Tage durchgezählt.
			let naechste = 1;
			for (const datum of tage) {
				raster.push(`  - datum: ${datum}`, "    tracks: [t1]", "    bloecke:");
				raster.push(
					`      - { id: b${naechste++}, von: "09:00", bis: "09:45" }`,
					`      - { id: b${naechste++}, von: "09:45", bis: "10:00", fix: Pause }`,
					`      - { id: b${naechste++}, von: "10:00", bis: "10:45" }`,
				);
			}
		}

		return this.app.vault.create(
			normalizePath(`${ordner}/${angaben.name}.md`),
			geruest(
				schemaFuer("konferenz")!,
				{
					...(angaben.untertitel ? { untertitel: angaben.untertitel } : {}),
					veranstalter: `"[[${angaben.veranstalter}]]"`,
					// Ohne Termin ist es noch keine Planung, sondern eine Idee.
					status: tage.length > 0 ? "planung" : "idee",
					...(angaben.honorarbudget ? { honorarbudget: String(angaben.honorarbudget) } : {}),
				},
				raster,
			),
		);
	}

	private async veranstalterAnlegen(name: string): Promise<TFile> {
		const ordner = this.plugin.settings.veranstalterOrdner;
		await this.ordnerSicherstellen(ordner);

		return this.app.vault.create(
			normalizePath(`${ordner}/${name}.md`),
			geruest(schemaFuer("veranstalter")!),
		);
	}

	/**
	 * Schreibt Tracks und Tage der Konferenz zurück. Das Raster gehört dem
	 * Plugin: Von Hand zerlegt ein falsches Leerzeichen im verschachtelten YAML
	 * nicht ein Feld, sondern das ganze Frontmatter.
	 *
	 * Obsidian schreibt dabei in seinem eigenen YAML-Stil — aus den knappen
	 * `{ id: b1, … }`-Zeilen werden ausgeschriebene Einträge. Der Inhalt bleibt
	 * derselbe, das Aussehen ändert sich einmalig.
	 */
	async rasterSchreiben(konferenz: Konferenz, tracks: Track[], tage: Tag[]): Promise<void> {
		await this.app.fileManager.processFrontMatter(konferenz.datei, (fm) => {
			fm.tracks = tracks.map((track) => ({
				id: track.id,
				name: track.name,
				...(track.raum ? { raum: track.raum } : {}),
				...(track.kapazitaet !== undefined ? { kapazitaet: track.kapazitaet } : {}),
			}));

			fm.tage = tage.map((tag) => ({
				...(tag.datum ? { datum: tag.datum } : {}),
				tracks: tag.tracks,
				bloecke: tag.bloecke.map((block) => ({
					id: block.id,
					...(block.von ? { von: block.von } : {}),
					...(block.bis ? { bis: block.bis } : {}),
					...(block.plenar ? { plenar: true } : {}),
					...(block.fix ? { fix: block.fix } : {}),
					...(block.nur.length > 0 ? { nur: block.nur } : {}),
				})),
			}));
		});
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

		return this.app.vault.create(
			normalizePath(`${ordner}/${name}.md`),
			geruest(schemaFuer("engagement")!, {
				konferenz: `"[[${konferenz.name}]]"`,
				speaker: `"[[${speaker}]]"`,
				status: "gemerkt",
				position: String(position),
			}),
		);
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
