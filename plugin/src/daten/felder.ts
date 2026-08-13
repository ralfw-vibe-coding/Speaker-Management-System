/**
 * Das Lesen einzelner Frontmatter-Felder — **tolerant**, wie im Konzept
 * verabredet: Ein fehlendes Feld ist kein Fehler, sondern der Normalfall am
 * Anfang einer Planung. Ein falscher Typ macht das Feld leer, statt die ganze
 * Notiz zu verwerfen.
 *
 * Hier steht nichts von Obsidian — deshalb ist es prüfbar, ohne den Vault zu
 * starten.
 */

export function text(wert: unknown): string | undefined {
	if (typeof wert === "string" && wert.trim().length > 0) return wert.trim();
	if (typeof wert === "number") return String(wert);
	return undefined;
}

export function zahl(wert: unknown): number | undefined {
	if (typeof wert === "number" && Number.isFinite(wert)) return wert;
	if (typeof wert === "string" && wert.trim().length > 0) {
		const n = Number(wert);
		if (Number.isFinite(n)) return n;
	}
	return undefined;
}

export function jaNein(wert: unknown): boolean {
	return wert === true || wert === "true";
}

/** Verträgt eine Liste, einen einzelnen Wert und nichts. */
export function liste(wert: unknown): string[] {
	if (Array.isArray(wert)) {
		return wert.map((e) => text(e)).filter((e): e is string => e !== undefined);
	}
	const einzeln = text(wert);
	return einzeln ? [einzeln] : [];
}

/** Aus `{ ki: 1, werkzeuge: 2 }` wird eine Zuordnung Thema → Wahl. */
export function zuordnung(wert: unknown): Map<string, number> {
	const karte = new Map<string, number>();
	if (!wert || typeof wert !== "object" || Array.isArray(wert)) return karte;
	for (const [schluessel, roh] of Object.entries(wert as Record<string, unknown>)) {
		const n = zahl(roh);
		if (n !== undefined) karte.set(schluessel, n);
	}
	return karte;
}

/**
 * Löst `"[[Ordner/Name|Alias]]"` zu `Name` auf. Obsidian löst Wikilinks über
 * den Dateinamen auf, nicht über den Pfad — also gilt der letzte Teil.
 */
export function linkName(wert: unknown): string | undefined {
	const roh = text(wert);
	if (!roh) return undefined;
	const ohneKlammern = roh.replace(/^\[\[/, "").replace(/\]\]$/, "");
	const ohneAlias = ohneKlammern.split("|")[0];
	const teile = ohneAlias.split("/");
	return teile[teile.length - 1].trim() || undefined;
}

/** Nur Einträge, die überhaupt Objekte sind — alles andere ist kein Eintrag. */
export function eintraege(wert: unknown): Record<string, unknown>[] {
	if (!Array.isArray(wert)) return [];
	return wert.filter(
		(e): e is Record<string, unknown> => !!e && typeof e === "object" && !Array.isArray(e),
	);
}
