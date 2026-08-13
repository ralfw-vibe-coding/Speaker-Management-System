import { App, TFile } from "obsidian";
import type SmsPlugin from "../main";
import type { Engagement, Konferenz, Speaker } from "./modell";

/**
 * Der Zugang zu den Notizen. Frontmatter kommt aus Obsidians `metadataCache`,
 * der es fertig geparst liefert und Änderungen meldet; nur für die
 * Notizvorschau wird der Body gelesen.
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
					tage: tageLesen(fm.tage),
				};
			})
			.sort((a, b) => b.name.localeCompare(a.name, "de"));
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

function text(wert: unknown): string | undefined {
	if (typeof wert === "string" && wert.trim().length > 0) return wert.trim();
	if (typeof wert === "number") return String(wert);
	return undefined;
}

function zahl(wert: unknown): number | undefined {
	if (typeof wert === "number" && Number.isFinite(wert)) return wert;
	if (typeof wert === "string" && wert.trim().length > 0) {
		const n = Number(wert);
		if (Number.isFinite(n)) return n;
	}
	return undefined;
}

/** Verträgt eine Liste, einen einzelnen Wert und nichts. */
function liste(wert: unknown): string[] {
	if (Array.isArray(wert)) {
		return wert.map((e) => text(e)).filter((e): e is string => e !== undefined);
	}
	const einzeln = text(wert);
	return einzeln ? [einzeln] : [];
}

/** Aus `{ ki: 1, werkzeuge: 2 }` wird eine Zuordnung Thema → Wahl. */
function zuordnung(wert: unknown): Map<string, number> {
	const karte = new Map<string, number>();
	if (!wert || typeof wert !== "object" || Array.isArray(wert)) return karte;
	for (const [schluessel, roh] of Object.entries(wert as Record<string, unknown>)) {
		const n = zahl(roh);
		if (n !== undefined) karte.set(schluessel, n);
	}
	return karte;
}

/** Löst `"[[Ordner/Name|Alias]]"` zu `Name` auf. */
function linkName(wert: unknown): string | undefined {
	const roh = text(wert);
	if (!roh) return undefined;
	const ohneKlammern = roh.replace(/^\[\[/, "").replace(/\]\]$/, "");
	const ohneAlias = ohneKlammern.split("|")[0];
	const teile = ohneAlias.split("/");
	return teile[teile.length - 1].trim() || undefined;
}

/** Aus der Liste `tage` nur die Daten — das Raster kommt mit der Agenda. */
function tageLesen(wert: unknown): string[] {
	if (!Array.isArray(wert)) return [];
	return wert
		.map((tag) => {
			if (!tag || typeof tag !== "object") return undefined;
			return text((tag as Record<string, unknown>).datum);
		})
		.filter((d): d is string => d !== undefined);
}
