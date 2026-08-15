import type { Block, Konferenz, Tag, Track } from "./modell";

/**
 * Die Regeln für Dateinamen und Termine. Sie tragen viel: Obsidian löst
 * Wikilinks über den Dateinamen auf, also entscheidet der Name über die
 * Identität einer Notiz. Kein Obsidian hier drin — deshalb prüfbar.
 */

/**
 * Zeichen, die Obsidian in Notiznamen verbietet. Beim Speaker ist der Name die
 * Datei — anders als beim Beitrag gibt es kein Feld, in das der ungekürzte
 * Titel ausweichen könnte. Deshalb wird dort abgelehnt statt bereinigt.
 */
export const VERBOTENE_ZEICHEN = /[*"\\/<>:|?#^[\]]/;

/** Die längste Konferenz, die noch plausibel ist — darüber ist eher das Jahr vertippt. */
export const HOECHSTENS_TAGE = 14;

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** Beim Beitrag wird bereinigt statt abgelehnt: Der Titel steht im Feld `titel`. */
export function ohneVerbotene(name: string): string {
	return name.replace(new RegExp(VERBOTENE_ZEICHEN.source, "g"), "").trim();
}

/**
 * `Assistenz Summit 2026 – Beitrag Mi 12 Uhr Werkzeuge & KI` — der Konferenzname
 * als Präfix, damit die Notiz vault-weit eindeutig heißt und die Backlink-Liste
 * am Speaker seine Historie ergibt.
 */
export function vorlaeufigerName(ziel: {
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

/**
 * Trägt die Notiz noch den Namen, den das Plugin ihr beim Anlegen gegeben hat?
 * Nur dann wird umbenannt — wer eine Beitragsnotiz einmal selbst benannt hat,
 * soll nicht später überstimmt werden.
 */
export function istPlatzhalterName(dateiname: string, konferenzName: string): boolean {
	return dateiname.startsWith(`${konferenzName} – Beitrag `);
}

/**
 * Zählt die Tage von `von` bis `bis` auf, beide einschließlich. Ohne `bis` ist
 * es ein Tag, ohne `von` gar keiner — dann ist die Konferenz noch eine Idee.
 */
export function tageZwischen(von?: string, bis?: string): string[] {
	if (!von) return [];

	const start = new Date(`${von}T00:00:00Z`);
	const ende = new Date(`${bis || von}T00:00:00Z`);
	if (Number.isNaN(start.getTime()) || Number.isNaN(ende.getTime())) return [];
	if (ende < start) return [];

	const tage: string[] = [];
	for (const lauf = new Date(start); lauf <= ende; lauf.setUTCDate(lauf.getUTCDate() + 1)) {
		if (tage.length >= HOECHSTENS_TAGE) break;
		tage.push(lauf.toISOString().slice(0, 10));
	}
	return tage;
}

/** Die Unterordner je Konferenz. Stehen so im Konzept und sind nicht konfigurierbar. */
export const BEITRAGSORDNER = "beiträge";
export const ENGAGEMENTORDNER = "engagements";

/**
 * Muss diese Notiz ein `type` tragen, damit das Plugin sie einordnen kann — oder
 * darf sie eine freie Notiz sein?
 *
 * Zuständig ist das Plugin dort, wo es selbst ablegt: in `engagements/` und
 * `beiträge/`, und für die Konferenznotiz, die wie ihr Ordner heisst. Alles
 * andere im Konferenzordner gehört dem Menschen — Gesprächsnotizen, Angebote,
 * Skizzen. Es taucht in keiner Sicht auf, und das ist keine Beanstandung
 * wert, sondern der Zweck.
 *
 * Ausserhalb des Konferenzordners bleibt es streng: Der Speakerordner ist flach
 * und enthält nur Speaker; eine Notiz ohne `type` ist dort ein zerschossenes
 * Frontmatter und soll auffallen.
 */
export function brauchtTyp(pfad: string, konferenzenOrdner: string): boolean {
	const gestutzt = konferenzenOrdner.replace(/\/+$/, "");
	if (gestutzt.length === 0 || !pfad.startsWith(`${gestutzt}/`)) return true;

	const teile = pfad.split("/");
	const datei = teile[teile.length - 1];
	const ordner = teile[teile.length - 2] ?? "";

	if (ordner === BEITRAGSORDNER || ordner === ENGAGEMENTORDNER) return true;
	// Die Konferenznotiz trägt den Namen ihres Ordners.
	return datei === `${ordner}.md`;
}
