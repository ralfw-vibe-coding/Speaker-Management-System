import type { TFile } from "obsidian";

/**
 * Die festgeschriebenen Formatwerte. Dieselbe Liste gilt für die `formate`
 * eines Speakers und das `format` eines Beitrags — sonst greift der Filter
 * „wer kann diesen Slot füllen?" ins Leere.
 */
export const FORMATE = ["keynote", "vortrag", "workshop", "panel", "moderation"] as const;

export const FORMAT_TITEL: Record<string, string> = {
	keynote: "Keynote",
	vortrag: "Vortrag",
	workshop: "Workshop",
	panel: "Panel",
	moderation: "Moderation",
};

/** Die Werte des Funnels in ihrer Reihenfolge. Die steht hier, nicht in den Daten. */
export const FUNNEL = [
	"gemerkt",
	"angefragt",
	"geantwortet",
	"verhandlung",
	"zugesagt",
	"rechnung",
	"bezahlt",
	"gestrichen",
] as const;

export const FUNNEL_TITEL: Record<string, string> = {
	gemerkt: "gemerkt",
	angefragt: "angefragt",
	geantwortet: "geantwortet",
	verhandlung: "in Verhandlung",
	zugesagt: "zugesagt",
	rechnung: "Rechnung",
	bezahlt: "bezahlt",
	gestrichen: "gestrichen",
};

export interface Speaker {
	datei: TFile;
	/** Der Dateiname ohne Endung — er ist die Identität, Wikilinks zeigen darauf. */
	name: string;
	rolle?: string;
	email?: string;
	telefon?: string;
	web?: string;
	themen: string[];
	/** Themen, zu denen eine Wahl getroffen ist. Fehlt ein Thema, ist es nicht eingeschätzt. */
	wahl: Map<string, number>;
	formate: string[];
	sprachen: string[];
	ort?: string;
	/** Richtwert je Auftritt, keine Vereinbarung. */
	honorarrahmen?: number;
	/** Erste Zeile unter „## Notizen", als Vorschau auf der Karte. */
	notiz?: string;
}

export interface Engagement {
	datei: TFile;
	/** Name der Konferenznotiz, aus dem Wikilink gelöst. */
	konferenz: string;
	/** Name der Speakernotiz, aus dem Wikilink gelöst. */
	speaker: string;
	status: string;
	position: number;
	honorar?: number;
	bewertung?: number;
	angefragtAm?: string;
	geantwortetAm?: string;
}

/**
 * Von der Konferenz wird vorerst nur gelesen, was der Katalog braucht.
 * Raster, Tracks und Slots kommen mit der Agenda dazu.
 */
export interface Konferenz {
	datei: TFile;
	name: string;
	untertitel?: string;
	veranstalter?: string;
	status?: string;
	/** Die Tage in der Reihenfolge, in der sie in der Notiz stehen. */
	tage: string[];
}

/** Ein Auftritt in der Historie eines Speakers — gerechnet, nirgends gespeichert. */
export interface Auftritt {
	konferenz: string;
	konferenzDatei?: TFile;
	/** Frühester Tag der Konferenz, zum Sortieren. Fehlt bei Konferenzen ohne Tage. */
	datum?: string;
	status: string;
	bewertung?: number;
}
