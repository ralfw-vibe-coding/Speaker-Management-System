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

/** „zugesagt und weiter" — die Karten, bei denen die Person an Bord ist. */
export const ZUGESAGT_UND_WEITER = ["zugesagt", "rechnung", "bezahlt"];

/**
 * Konferenzstatus, an denen nicht mehr geplant wird. Ihr Programm ist Archiv —
 * der Funnel läuft trotzdem weiter, denn Rechnungen und Zahlungen kommen erst
 * nach der Konferenz.
 */
export function istArchiv(konferenz: Konferenz | undefined): boolean {
	return konferenz?.status === "gelaufen" || konferenz?.status === "abgesagt";
}

/** Der Fortschritt einer Checkliste. Gezählt, nie gespeichert. */
export interface Aufgaben {
	erledigt: number;
	gesamt: number;
}

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
	/** Das vereinbarte oder angebotene Honorar für das ganze Paket. */
	honorar?: number;
	bewertung?: number;
	angefragtAm?: string;
	geantwortetAm?: string;
	aufgaben: Aufgaben;
}

export interface Beitrag {
	datei: TFile;
	konferenz: string;
	/** Das Feld ist eine Liste; das Plugin schreibt nur einen Namen hinein. */
	speaker: string[];
	titel?: string;
	format?: string;
	maxTeilnehmer?: number;
	/**
	 * Die **gewünschte** Dauer in Minuten, mit dem Speaker verhandelt. Die
	 * tatsächliche ergibt sich weiterhin aus den Blöcken; hier steht, was der
	 * Beitrag braucht — so wie `max_teilnehmer` steht, was er verträgt.
	 */
	dauer?: number;
	/**
	 * Die Blöcke, über die der Beitrag läuft. Leer heißt: im Pool. Ein langer
	 * Workshop belegt mehrere; das Feld heißt im Frontmatter `block` und
	 * verträgt einen einzelnen Wert wie eine Liste.
	 */
	bloecke: string[];
	/** Entfällt bei plenaren Blöcken. */
	track?: string;
	aufgaben: Aufgaben;
}

export interface Track {
	id: string;
	name: string;
	raum?: string;
	kapazitaet?: number;
}

export interface Block {
	id: string;
	von?: string;
	bis?: string;
	plenar?: boolean;
	/** Programmpunkt ohne Speaker: Pause, Registrierung, Abendprogramm. */
	fix?: string;
	/** Schränkt den Block auf bestimmte Tracks ein. */
	nur: string[];
}

export interface Tag {
	datum?: string;
	tracks: string[];
	bloecke: Block[];
}

/** Eine Ausnahme von dem, was der Track vorgibt. Ohne `track`: die ganze Blockzeile. */
export interface SlotAngabe {
	block: string;
	track?: string;
	raum?: string;
	kapazitaet?: number;
}

export interface Konferenz {
	datei: TFile;
	name: string;
	untertitel?: string;
	veranstalter?: string;
	status?: string;
	honorarbudget?: number;
	deadlineProgramm?: string;
	tracks: Track[];
	tage: Tag[];
	/** Trägt nur die Ausnahmen; der Normalfall steht am Track. */
	slots: SlotAngabe[];
}

/**
 * Zählt die Slots eines Tages: das Kreuzprodukt aus Blöcken und Tracks, minus
 * Fixblöcke. Der plenare Block ist genau ein Slot, weil er alle Tracks belegt.
 * Der leere Slot bleibt dabei ein Loch, kein Datenobjekt.
 */
export function slotsEinesTages(
	konferenz: Konferenz,
	tag: Tag,
	belegt: (blockId: string, trackId?: string) => boolean,
): { gesamt: number; belegt: number } {
	const tracks = konferenz.tracks.filter((track) => tag.tracks.includes(track.id));

	let gesamt = 0;
	let gefuellt = 0;
	for (const block of tag.bloecke) {
		if (block.fix) continue;

		if (block.plenar) {
			gesamt++;
			if (belegt(block.id)) gefuellt++;
			continue;
		}

		for (const track of tracks) {
			if (block.nur.length > 0 && !block.nur.includes(track.id)) continue;
			gesamt++;
			if (belegt(block.id, track.id)) gefuellt++;
		}
	}
	return { gesamt, belegt: gefuellt };
}

/**
 * Raum und Kapazität kaskadieren: Der speziellere Eintrag gewinnt. Der Eintrag
 * ohne `track` deckt die ganze Blockzeile ab — und den plenaren Slot, der von
 * keinem Track erbt.
 */
export function raumFuer(
	konferenz: Konferenz,
	blockId: string,
	trackId?: string,
): { raum?: string; kapazitaet?: number; abweichend: boolean } {
	const genau = trackId
		? konferenz.slots.find((s) => s.block === blockId && s.track === trackId)
		: undefined;
	if (genau) return { raum: genau.raum, kapazitaet: genau.kapazitaet, abweichend: true };

	const zeile = konferenz.slots.find((s) => s.block === blockId && !s.track);
	if (zeile) return { raum: zeile.raum, kapazitaet: zeile.kapazitaet, abweichend: true };

	const track = trackId ? konferenz.tracks.find((t) => t.id === trackId) : undefined;
	return { raum: track?.raum, kapazitaet: track?.kapazitaet, abweichend: false };
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
