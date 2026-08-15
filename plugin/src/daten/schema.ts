/**
 * **Die eine Feldliste.** Aus ihr entstehen das Gerüst beim Anlegen, das
 * Ergänzen fehlender Felder in alten Notizen und die Feldtabellen der
 * ausgelieferten Doku. Vorher stand dieselbe Liste an vier Stellen, und genau
 * das ist zweimal schiefgegangen: Bei `reisekosten` und bei `foto` hatte ich
 * das Gerüst vergessen, sodass die Felder in bestehenden Notizen fehlten und
 * Obsidian sie nicht anzeigte.
 *
 * Hier steht **was es gibt**, nicht wie es gelesen oder gezeichnet wird — das
 * bleibt Sache von `lesen.ts` und der Sichten.
 */

export type Feldart = "text" | "zahl" | "link" | "liste" | "linkliste" | "zuordnung";

export interface Feld {
	/** Der Name im Frontmatter. */
	name: string;
	art: Feldart;
	/** Wofür das Feld da ist — die Quelle der Feldtabellen in der Doku. */
	bedeutung: string;
	/**
	 * Frühere Namen desselben Feldes. Tolerantes Lesen folgt daraus, statt aus
	 * verstreuten Sonderfällen — und eine spätere Umbenennung weiß, was wohin
	 * wandert.
	 */
	frueher?: string[];
	/**
	 * Wie eine Auswertung mit einem fehlenden Wert umgeht. `neutral` heißt: als
	 * 0 oder leer rechnen, weil das die richtige Aussage ist. `unbekannt` heißt:
	 * getrennt ausweisen — sonst sähe eine Lücke im Wissen aus wie eine Lücke in
	 * der Sache.
	 */
	fehlend?: "neutral" | "unbekannt";
	/** Steht das Feld im Gerüst einer neuen Notiz? */
	imGeruest?: boolean;
}

export interface Abschnitt {
	/** Die Überschrift ohne `##`. */
	titel: string;
	/** Zeilen darunter — bei Checklisten die Punkte. */
	zeilen?: string[];
}

export interface Notizschema {
	typ: string;
	titel: string;
	felder: Feld[];
	abschnitte: Abschnitt[];
}

/**
 * Die Schemaversion des Plugins. Sie steigt, sobald sich an den Notizen etwas
 * ändert, das mehr ist als ein neues Feld — eine Umbenennung, ein Typwechsel,
 * ein Zusammenlegen. Der Vault merkt sich seinen Stand in der `data.json` des
 * Plugins; hier ist der Ort, an dem der erste umformende Schritt später steht.
 *
 * Für rein additive Änderungen braucht es sie nicht: Ob Felder fehlen, sieht
 * man den Notizen an, und das Ergänzen ist folgenlos, wenn nichts fehlt.
 */
export const SCHEMA_VERSION = 1;

const SPEAKER: Notizschema = {
	typ: "speaker",
	titel: "Speaker",
	felder: [
		{ name: "rolle", art: "text", bedeutung: "Funktion oder Firma, erscheint auf der Katalogkarte" },
		{ name: "foto", art: "text", bedeutung: "Bild im Vault: Wikilink, Pfad oder Adresse" },
		{ name: "email", art: "text", bedeutung: "Kontakt" },
		{ name: "telefon", art: "text", bedeutung: "Kontakt" },
		{ name: "web", art: "text", bedeutung: "Profil, Blog, Referenzen" },
		{ name: "themen", art: "liste", bedeutung: "freies Vokabular, der wichtigste Filter" },
		{ name: "zielgruppe", art: "liste", bedeutung: "für wen dieser Mensch passt" },
		{
			name: "wahl",
			art: "zuordnung",
			bedeutung: "erste, zweite, dritte Wahl je Thema",
			// Sie entsteht erst, wenn man sich festgelegt hat — leer wäre sie sinnlos.
			imGeruest: false,
		},
		{ name: "formate", art: "liste", bedeutung: "keynote, vortrag, workshop, panel, moderation" },
		{ name: "sprachen", art: "liste", bedeutung: "z. B. de, en" },
		{ name: "ort", art: "text", bedeutung: "für die Einschätzung der Anreise" },
		{
			name: "honorarrahmen",
			art: "zahl",
			bedeutung: "Richtwert je Auftritt, keine Vereinbarung",
			fehlend: "unbekannt",
		},
	],
	abschnitte: [
		{ titel: "Bio" },
		{ titel: "Profil" },
		{ titel: "Notizen" },
	],
};

const VERANSTALTER: Notizschema = {
	typ: "veranstalter",
	titel: "Veranstalter",
	felder: [
		{ name: "ansprechpartner", art: "text", bedeutung: "wer dort zuständig ist" },
		{ name: "email", art: "text", bedeutung: "Kontakt" },
		{ name: "telefon", art: "text", bedeutung: "Kontakt" },
	],
	abschnitte: [{ titel: "Konditionen" }, { titel: "Notizen" }],
};

const KONFERENZ: Notizschema = {
	typ: "konferenz",
	titel: "Konferenz",
	felder: [
		{ name: "untertitel", art: "text", bedeutung: "thematischer Zusatz im Kopf der Sichten" },
		{ name: "veranstalter", art: "link", bedeutung: "der Auftraggeber" },
		{ name: "status", art: "text", bedeutung: "idee, planung, programm-steht, gelaufen, abgesagt" },
		{
			name: "teilnehmer",
			art: "zahl",
			bedeutung: "erwartete Gäste; Maßstab für die Plätze je Block",
			fehlend: "unbekannt",
		},
		{
			name: "honorarbudget",
			art: "zahl",
			bedeutung: "Rahmen, gegen den die Engagement-Honorare laufen",
			fehlend: "unbekannt",
		},
		{ name: "deadline_programm", art: "text", bedeutung: "Datum JJJJ-MM-TT" },
		{
			name: "straenge",
			art: "liste",
			bedeutung: "die Themenlinien der Konzeption, vor dem Raster",
			imGeruest: false,
		},
		// Das Raster schreibt das Plugin; im Gerüst steht es nur beim Anlegen mit Termin.
		{ name: "tracks", art: "liste", bedeutung: "die Spalten des Rasters", imGeruest: false },
		{ name: "tage", art: "liste", bedeutung: "je Tag die Zeilen des Rasters", imGeruest: false },
		{ name: "slots", art: "liste", bedeutung: "nur Ausnahmen von Raum und Kapazität", imGeruest: false },
	],
	abschnitte: [
		{ titel: "Ausrichtung" },
		{
			titel: "Mit dem Veranstalter zu klären",
			zeilen: [
				"- [ ] Honorarbudget bestätigt",
				"- [ ] Anzahl Tracks und Slots final",
				"- [ ] Reisekosten-Regelung",
				"- [ ] Wer schließt die Verträge?",
			],
		},
		{ titel: "Notizen" },
	],
};

const ENGAGEMENT: Notizschema = {
	typ: "engagement",
	titel: "Engagement",
	felder: [
		{ name: "konferenz", art: "link", bedeutung: "zu welcher Konferenz" },
		{ name: "speaker", art: "link", bedeutung: "welcher Mensch" },
		{ name: "status", art: "text", bedeutung: "die acht Stufen des Funnels" },
		{
			name: "rollen",
			art: "liste",
			bedeutung: "Aufgaben ohne eigenen Slot, derzeit nur moderation",
			// Keine Rolle heißt: keine. Das ist eine Aussage, keine Lücke.
			fehlend: "neutral",
		},
		{ name: "position", art: "zahl", bedeutung: "Reihenfolge in der Spalte", fehlend: "neutral" },
		{
			name: "honorar",
			art: "zahl",
			bedeutung: "vereinbart oder angeboten, für das ganze Paket",
			// Nicht vereinbart trägt nichts zur Summe bei — hier ist null die Aussage.
			fehlend: "neutral",
		},
		{
			name: "reisekosten",
			art: "zahl",
			bedeutung: "eigener Betrag, läuft nicht gegen das Honorarbudget",
			fehlend: "neutral",
		},
		{ name: "angefragt_am", art: "text", bedeutung: "Datum" },
		{ name: "geantwortet_am", art: "text", bedeutung: "Datum" },
		{ name: "rechnung_am", art: "text", bedeutung: "Datum" },
		{ name: "bezahlt_am", art: "text", bedeutung: "Datum" },
		{
			name: "bewertung",
			art: "zahl",
			bedeutung: "ein bis fünf Sterne, erst nach der Konferenz",
			fehlend: "unbekannt",
		},
	],
	abschnitte: [
		{
			titel: "Zu klären",
			zeilen: [
				"- [ ] Bio erhalten",
				"- [ ] Foto erhalten",
				"- [ ] Vertrag zurück",
				"- [ ] Reisekosten geklärt",
			],
		},
		{ titel: "Gesprächsnotizen" },
	],
};

const BEITRAG: Notizschema = {
	typ: "beitrag",
	titel: "Beitrag",
	felder: [
		{ name: "konferenz", art: "link", bedeutung: "zu welcher Konferenz" },
		{ name: "speaker", art: "linkliste", bedeutung: "das Plugin schreibt einen Namen hinein" },
		{ name: "titel", art: "text", bedeutung: "darf leer sein — dann ist das Thema noch offen" },
		{ name: "format", art: "text", bedeutung: "dieselben Werte wie beim Speaker" },
		{
			name: "dauer",
			art: "zahl",
			bedeutung: "gewünschte Dauer in Minuten",
			fehlend: "unbekannt",
		},
		{
			name: "max_teilnehmer",
			art: "zahl",
			bedeutung: "Obergrenze, die der Beitrag mitbringt",
			fehlend: "unbekannt",
		},
		{
			name: "strang",
			art: "text",
			bedeutung: "die Themenlinie in der Konzeption; bleibt stehen, wenn ein Track dazukommt",
		},
		{
			name: "verworfen_am",
			art: "text",
			bedeutung: "Datum — gesetzt heißt: in der Konzeption aussortiert, aber aufgehoben",
		},
		{
			name: "block",
			art: "liste",
			bedeutung: "leer = im Pool; mehrere = über mehrere Blöcke",
			fehlend: "neutral",
		},
		{ name: "track", art: "text", bedeutung: "entfällt bei plenaren Blöcken" },
	],
	abschnitte: [
		{
			titel: "Zu klären",
			zeilen: [
				"- [ ] Abstract eingereicht",
				"- [ ] Folien eingereicht",
				"- [ ] Technikbedarf geklärt",
			],
		},
		{ titel: "Abstract" },
		{ titel: "Für den Speaker" },
	],
};

export const SCHEMATA: Notizschema[] = [SPEAKER, VERANSTALTER, KONFERENZ, ENGAGEMENT, BEITRAG];

export function schemaFuer(typ: string): Notizschema | undefined {
	return SCHEMATA.find((schema) => schema.typ === typ);
}

/** Alle Namen, unter denen ein Feld schon einmal stand — der jetzige zuerst. */
export function namen(feld: Feld): string[] {
	return [feld.name, ...(feld.frueher ?? [])];
}

/** Die Zeile, mit der ein Feld im Gerüst einer neuen Notiz steht. */
export function geruestzeile(feld: Feld): string {
	return feld.art === "liste" || feld.art === "linkliste" ? `${feld.name}: []` : `${feld.name}:`;
}

/** Das Gerüst einer neuen Notiz: Frontmatter und leere Abschnitte. */
export function geruest(
	schema: Notizschema,
	vorgaben: Record<string, string> = {},
	zusatz: string[] = [],
): string {
	const zeilen = ["---", `type: ${schema.typ}`];

	for (const feld of schema.felder) {
		if (feld.imGeruest === false && vorgaben[feld.name] === undefined) continue;
		const wert = vorgaben[feld.name];
		zeilen.push(wert === undefined ? geruestzeile(feld) : `${feld.name}: ${wert}`);
	}

	zeilen.push(...zusatz, "---");
	for (const abschnitt of schema.abschnitte) {
		zeilen.push(`## ${abschnitt.titel}`, ...(abschnitt.zeilen ?? []), "", "");
	}
	return zeilen.join("\n");
}
