import { App, TFile } from "obsidian";
import type SmsPlugin from "../main";
import { eintraege, jaNein, liste, linkName, text, zahl, zuordnung } from "./felder";
import type {
	Aufgaben,
	Beitrag,
	Block,
	Engagement,
	Konferenz,
	SlotAngabe,
	Speaker,
	Tag,
	Track,
} from "./modell";

/** Die Überschrift, unter der in jeder Notiz die Checkliste steht. */
const CHECKLISTE = "Zu klären";

/**
 * Der Zugang zu den Notizen. Frontmatter, Überschriften und Aufgaben kommen
 * aus Obsidians `metadataCache`, der sie fertig geparst liefert und Änderungen
 * meldet; nur für die Notizvorschau wird der Body gelesen.
 *
 * Gelesen wird durchweg **tolerant**: Ein fehlendes Feld ist kein Fehler,
 * sondern der Normalfall am Anfang einer Planung. Ein falscher Typ macht das
 * Feld leer, statt die ganze Notiz zu verwerfen.
 */
export class Datenzugriff {
	constructor(private app: App, private plugin: SmsPlugin) {}

	async speaker(): Promise<Speaker[]> {
		const dateien = this.notizen(this.plugin.settings.speakerOrdner, "speaker");

		const gelesen = await Promise.all(
			dateien.map(async (datei) => {
				const fm = this.frontmatter(datei) ?? {};
				return {
					datei,
					name: datei.basename,
					rolle: text(fm.rolle),
					email: text(fm.email),
					telefon: text(fm.telefon),
					web: text(fm.web),
					themen: liste(fm.themen),
					wahl: zuordnung(fm.wahl),
					formate: liste(fm.formate),
					sprachen: liste(fm.sprachen),
					ort: text(fm.ort),
					honorarrahmen: zahl(fm.honorarrahmen),
					notiz: await this.ersteZeileUnter(datei, "Notizen"),
				};
			}),
		);

		return gelesen.sort((a, b) => a.name.localeCompare(b.name, "de"));
	}

	engagements(): Engagement[] {
		return this.notizen(this.plugin.settings.konferenzenOrdner, "engagement").map((datei) => {
			const fm = this.frontmatter(datei) ?? {};
			return {
				datei,
				konferenz: linkName(fm.konferenz) ?? "",
				speaker: linkName(fm.speaker) ?? "",
				status: text(fm.status) ?? "gemerkt",
				position: zahl(fm.position) ?? 0,
				honorar: zahl(fm.honorar),
				bewertung: zahl(fm.bewertung),
				angefragtAm: text(fm.angefragt_am),
				geantwortetAm: text(fm.geantwortet_am),
				aufgaben: this.aufgaben(datei),
			};
		});
	}

	beitraege(): Beitrag[] {
		return this.notizen(this.plugin.settings.konferenzenOrdner, "beitrag").map((datei) => {
			const fm = this.frontmatter(datei) ?? {};
			return {
				datei,
				konferenz: linkName(fm.konferenz) ?? "",
				speaker: liste(fm.speaker)
					.map((eintrag) => linkName(eintrag))
					.filter((name): name is string => name !== undefined),
				titel: text(fm.titel),
				format: text(fm.format),
				maxTeilnehmer: zahl(fm.max_teilnehmer),
				dauer: zahl(fm.dauer),
				bloecke: liste(fm.block),
				track: text(fm.track),
				aufgaben: this.aufgaben(datei),
			};
		});
	}

	konferenzen(): Konferenz[] {
		return this.notizen(this.plugin.settings.konferenzenOrdner, "konferenz")
			.map((datei) => {
				const fm = this.frontmatter(datei) ?? {};
				return {
					datei,
					name: datei.basename,
					untertitel: text(fm.untertitel),
					veranstalter: linkName(fm.veranstalter),
					status: text(fm.status),
					honorarbudget: zahl(fm.honorarbudget),
					deadlineProgramm: text(fm.deadline_programm),
					tracks: tracksLesen(fm.tracks),
					tage: tageLesen(fm.tage),
					slots: slotsLesen(fm.slots),
				};
			})
			// Die jüngste Konferenz zuerst — an ihr wird gerade gearbeitet. Wer
			// noch keinen Termin hat, steht hinten: Eine Idee ohne Raster wäre
			// eine schlechte Voreinstellung.
			.sort((a, b) => {
				const eigenes = a.tage[0]?.datum;
				const fremdes = b.tage[0]?.datum;
				if (eigenes && fremdes) return fremdes.localeCompare(eigenes);
				if (eigenes) return -1;
				if (fremdes) return 1;
				return b.name.localeCompare(a.name, "de");
			});
	}

	/** Nur die Namen — für Prüfungen, die keine ganzen Speaker brauchen. */
	speakerNamen(): string[] {
		return this.notizen(this.plugin.settings.speakerOrdner, "speaker").map(
			(datei) => datei.basename,
		);
	}

	/** Nur Datei und Name — mehr braucht bisher niemand vom Veranstalter. */
	veranstalter(): { datei: TFile; name: string }[] {
		return this.notizen(this.plugin.settings.veranstalterOrdner, "veranstalter")
			.map((datei) => ({ datei, name: datei.basename }))
			.sort((a, b) => a.name.localeCompare(b.name, "de"));
	}

	/**
	 * Notizen in den eigenen Ordnern, die das Plugin nicht einordnen kann: ohne
	 * `type`, weil das Frontmatter kaputt ist oder fehlt, oder mit einem `type`,
	 * den es nicht kennt.
	 *
	 * Ohne diese Liste verschwinden sie lautlos aus allen Sichten — das ist der
	 * Preis dafür, dass die Sichten Projektionen sind und nur zeigen, was sie
	 * verstehen.
	 */
	unbekannteNotizen(): { datei: TFile; text: string }[] {
		const bekannt = new Set(["speaker", "veranstalter", "konferenz", "engagement", "beitrag"]);
		const ordner = [
			this.plugin.settings.speakerOrdner,
			this.plugin.settings.veranstalterOrdner,
			this.plugin.settings.konferenzenOrdner,
		]
			.filter((eigener) => eigener.length > 0)
			.map((eigener) => eigener.replace(/\/+$/, "") + "/");

		return this.app.vault
			.getMarkdownFiles()
			.filter((datei) => ordner.some((praefix) => datei.path.startsWith(praefix)))
			.map((datei) => {
				const typ = this.frontmatter(datei)?.type;
				if (typ === undefined) {
					return { datei, text: "ohne `type` — steht das Frontmatter richtig da?" };
				}
				if (typeof typ !== "string" || !bekannt.has(typ)) {
					return { datei, text: `unbekannter type: ${String(typ)}` };
				}
				return undefined;
			})
			.filter((eintrag): eintrag is { datei: TFile; text: string } => eintrag !== undefined);
	}

	/**
	 * Zählt die Markdown-Tasks unter `## Zu klären`. Der `metadataCache` kennt
	 * Überschriften und Aufgaben samt Zeile, sodass der Body ungelesen bleibt.
	 */
	private aufgaben(datei: TFile): Aufgaben {
		const cache = this.app.metadataCache.getFileCache(datei);
		const ueberschriften = cache?.headings ?? [];

		const start = ueberschriften.find((h) => h.heading === CHECKLISTE);
		if (!start) return { erledigt: 0, gesamt: 0 };

		const ersteZeile = start.position.start.line;
		const naechste = ueberschriften
			.filter((h) => h.position.start.line > ersteZeile && h.level <= start.level)
			.reduce((frueheste, h) => Math.min(frueheste, h.position.start.line), Infinity);

		let erledigt = 0;
		let gesamt = 0;
		for (const eintrag of cache?.listItems ?? []) {
			if (eintrag.task === undefined) continue;
			const zeile = eintrag.position.start.line;
			if (zeile <= ersteZeile || zeile >= naechste) continue;
			gesamt++;
			if (eintrag.task.toLowerCase() === "x") erledigt++;
		}
		return { erledigt, gesamt };
	}

	/** Alle Markdown-Notizen unterhalb eines Ordners mit passendem `type`. */
	private notizen(ordner: string, typ: string): TFile[] {
		const praefix = ordner.replace(/\/+$/, "") + "/";
		return this.app.vault.getMarkdownFiles().filter((datei) => {
			if (ordner && !datei.path.startsWith(praefix)) return false;
			return this.frontmatter(datei)?.type === typ;
		});
	}

	private frontmatter(datei: TFile): Record<string, unknown> | undefined {
		return this.app.metadataCache.getFileCache(datei)?.frontmatter;
	}

	/**
	 * Die erste nichtleere Zeile unter einer Überschrift. Der `metadataCache`
	 * kennt die Überschriften samt Zeilennummer, den Text darunter nicht —
	 * dafür wird der Body gelesen.
	 */
	private async ersteZeileUnter(datei: TFile, ueberschrift: string): Promise<string | undefined> {
		const kopf = this.app.metadataCache
			.getFileCache(datei)
			?.headings?.find((h) => h.heading === ueberschrift);
		if (!kopf) return undefined;

		const zeilen = (await this.app.vault.cachedRead(datei)).split("\n");
		for (let i = kopf.position.start.line + 1; i < zeilen.length; i++) {
			const zeile = zeilen[i].trim();
			if (zeile.startsWith("#")) return undefined;
			if (zeile.length > 0) return zeile;
		}
		return undefined;
	}
}

function tracksLesen(wert: unknown): Track[] {
	return eintraege(wert)
		.map((roh) => ({
			id: text(roh.id) ?? "",
			name: text(roh.name) ?? "",
			raum: text(roh.raum),
			kapazitaet: zahl(roh.kapazitaet),
		}))
		.filter((track) => track.id.length > 0);
}

function bloeckeLesen(wert: unknown): Block[] {
	return eintraege(wert)
		.map((roh) => ({
			id: text(roh.id) ?? "",
			von: text(roh.von),
			bis: text(roh.bis),
			plenar: jaNein(roh.plenar),
			fix: text(roh.fix),
			nur: liste(roh.nur),
		}))
		.filter((block) => block.id.length > 0);
}

function slotsLesen(wert: unknown): SlotAngabe[] {
	return eintraege(wert)
		.map((roh) => ({
			block: text(roh.block) ?? "",
			track: text(roh.track),
			raum: text(roh.raum),
			kapazitaet: zahl(roh.kapazitaet),
		}))
		.filter((slot) => slot.block.length > 0);
}

/** Ein Tag ohne `bloecke` ist erlaubt — eine gelaufene Konferenz hat kein Raster mehr. */
function tageLesen(wert: unknown): Tag[] {
	return eintraege(wert).map((roh) => ({
		datum: text(roh.datum),
		tracks: liste(roh.tracks),
		bloecke: bloeckeLesen(roh.bloecke),
	}));
}
