import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	dauerImRaster,
	doppeltBelegte,
	erwartetBeitrag,
	frueherGehalten,
	hatRolle,
	heimatlos,
	historienbild,
	parallelStehende,
	plaetzeEinesBlocks,
	plaetzeEinesSlots,
	slotZustand,
	ueberschneidungen,
	verschoben,
	verwaisteVerweise,
	zeitgleich,
	zielBloecke,
} from "../src/daten/projektion";
import { beitrag, block, engagement, konferenz, tag, track } from "./hilfe";

/** Ein Tag wie im Test-Vault: Keynote, Pause, zwei Blöcke, zwei Tracks. */
function tagesraster() {
	return konferenz({
		tracks: [track("t1", "Rolle & Zukunft"), track("t2", "Werkzeuge & KI")],
		tage: [
			tag("2026-11-04", ["t1", "t2"], [
				block("b1", "09:00", "09:30", { plenar: true }),
				block("b2", "09:30", "10:00", { fix: "Pause" }),
				block("b3", "10:00", "10:45"),
				block("b4", "11:00", "11:45"),
			]),
		],
	});
}

describe("slotZustand", () => {
	it("ohne Beitrag ist der Slot ein Loch", () => {
		assert.equal(slotZustand(undefined, undefined), "leer");
	});

	it("Thema ohne Speaker ist halb", () => {
		assert.equal(slotZustand(beitrag({ titel: "Thema" }), undefined), "halb");
	});

	it("Speaker ohne Thema ist ebenfalls halb", () => {
		assert.equal(slotZustand(beitrag({ speaker: ["Wer"] }), undefined), "halb");
	});

	it("gefüllt, aber ohne Zusage: auf Verdacht platziert", () => {
		const gefuellt = beitrag({ titel: "Thema", speaker: ["Wer"] });
		assert.equal(slotZustand(gefuellt, engagement({ status: "angefragt" })), "verdacht");
	});

	it("grün erst mit Zusage — das Minimum aus Füllung und Engagement", () => {
		const gefuellt = beitrag({ titel: "Thema", speaker: ["Wer"] });
		assert.equal(slotZustand(gefuellt, engagement({ status: "zugesagt" })), "gruen");
		assert.equal(slotZustand(gefuellt, engagement({ status: "bezahlt" })), "gruen");
	});
});

describe("heimatlos", () => {
	const raster = tagesraster();

	it("ohne Block liegt der Beitrag im Pool, nicht in der Heimatlosigkeit", () => {
		assert.equal(heimatlos(beitrag(), raster), false);
	});

	it("ein Block, den es gibt, ist keine Heimatlosigkeit", () => {
		assert.equal(heimatlos(beitrag({ bloecke: ["b3"], track: "t1" }), raster), false);
	});

	it("ein Block, den es nicht mehr gibt, macht heimatlos", () => {
		assert.equal(heimatlos(beitrag({ bloecke: ["b9"], track: "t1" }), raster), true);
	});

	it("ein Track, den es nicht mehr gibt, ebenfalls — der Fall aus dem Vault", () => {
		assert.equal(heimatlos(beitrag({ bloecke: ["b3"], track: "t4" }), raster), true);
	});

	it("ohne Track ist ein plenarer Beitrag zu Hause", () => {
		assert.equal(heimatlos(beitrag({ bloecke: ["b1"] }), raster), false);
	});
});

describe("dauerImRaster", () => {
	const eigenerTag = tagesraster().tage[0];

	it("zählt einen Block", () => {
		assert.equal(dauerImRaster(beitrag({ bloecke: ["b3"] }), eigenerTag), 45);
	});

	it("zählt mehrere zusammen", () => {
		assert.equal(dauerImRaster(beitrag({ bloecke: ["b3", "b4"] }), eigenerTag), 90);
	});

	it("zählt den Fixblock dazwischen nicht mit — in der Pause arbeitet niemand", () => {
		assert.equal(dauerImRaster(beitrag({ bloecke: ["b1", "b3"] }), eigenerTag), 75);
	});
});

describe("ueberschneidungen", () => {
	it("ein lückenloser Tag hat keine", () => {
		assert.equal(ueberschneidungen(tagesraster().tage[0]), 0);
	});

	it("zählt einen Block, der in den vorherigen hineinragt", () => {
		const eigener = tag("2026-11-04", ["t1"], [
			block("b1", "09:00", "10:00"),
			block("b2", "09:45", "10:30"),
		]);
		assert.equal(ueberschneidungen(eigener), 1);
	});

	it("eine Lücke ist keine Überschneidung", () => {
		const eigener = tag("2026-11-04", ["t1"], [
			block("b1", "09:00", "10:00"),
			block("b2", "10:30", "11:00"),
		]);
		assert.equal(ueberschneidungen(eigener), 0);
	});
});

describe("doppeltBelegte", () => {
	const eigenerTag = tagesraster().tage[0];

	it("zwei Beiträge im selben Slot sind eine Doppelbelegung", () => {
		const beitraege = [
			beitrag({ bloecke: ["b3"], track: "t1" }),
			beitrag({ bloecke: ["b3"], track: "t1" }),
		];
		assert.equal(doppeltBelegte(eigenerTag, beitraege), 1);
	});

	it("derselbe Block in verschiedenen Tracks ist keine", () => {
		const beitraege = [
			beitrag({ bloecke: ["b3"], track: "t1" }),
			beitrag({ bloecke: ["b3"], track: "t2" }),
		];
		assert.equal(doppeltBelegte(eigenerTag, beitraege), 0);
	});
});

describe("parallelStehende und zeitgleich", () => {
	const eigenerTag = tagesraster().tage[0];

	it("erkennt denselben Speaker in zwei gleichzeitigen Beiträgen", () => {
		const beitraege = [
			beitrag({ bloecke: ["b3"], track: "t1", speaker: ["Marek"] }),
			beitrag({ bloecke: ["b3"], track: "t2", speaker: ["Marek"] }),
		];
		assert.equal(parallelStehende(eigenerTag, beitraege), 1);
		assert.equal(zeitgleich(beitraege[0], beitraege).length, 1);
	});

	it("nacheinander ist kein Problem", () => {
		const beitraege = [
			beitrag({ bloecke: ["b3"], track: "t1", speaker: ["Marek"] }),
			beitrag({ bloecke: ["b4"], track: "t1", speaker: ["Marek"] }),
		];
		assert.equal(parallelStehende(eigenerTag, beitraege), 0);
		assert.equal(zeitgleich(beitraege[0], beitraege).length, 0);
	});

	it("ein langer Workshop kollidiert auch mit dem zweiten Block", () => {
		const beitraege = [
			beitrag({ bloecke: ["b3", "b4"], track: "t1", speaker: ["Marek"] }),
			beitrag({ bloecke: ["b4"], track: "t2", speaker: ["Marek"] }),
		];
		assert.equal(parallelStehende(eigenerTag, beitraege), 1);
	});
});

describe("zielBloecke", () => {
	const eigenerTag = tagesraster().tage[0];

	it("ein einzelner Beitrag landet auf einem Block", () => {
		assert.deepEqual(zielBloecke(beitrag({ bloecke: ["b4"] }), eigenerTag, "b3"), ["b3"]);
	});

	it("ein Beitrag über zwei Blöcke bleibt zwei Blöcke lang", () => {
		const lang = beitrag({ bloecke: ["b3", "b4"] });
		assert.deepEqual(zielBloecke(lang, eigenerTag, "b1"), ["b1", "b3"]);
	});

	it("überspringt dabei den Fixblock", () => {
		const lang = beitrag({ bloecke: ["b3", "b4"] });
		assert.equal(zielBloecke(lang, eigenerTag, "b1").includes("b2"), false);
	});

	it("am Ende des Tages bleibt er kürzer, statt zu erfinden", () => {
		const lang = beitrag({ bloecke: ["b3", "b4"] });
		assert.deepEqual(zielBloecke(lang, eigenerTag, "b4"), ["b4"]);
	});
});

describe("plaetzeEinesSlots", () => {
	it("ein leerer Slot bietet niemandem einen Platz", () => {
		assert.equal(plaetzeEinesSlots(undefined, 400), undefined);
	});

	it("ohne beide Angaben ist die Zahl unbekannt, nicht null", () => {
		assert.equal(plaetzeEinesSlots(beitrag(), undefined), undefined);
	});

	it("nimmt den Raum, wenn der Beitrag nichts vorgibt", () => {
		assert.equal(plaetzeEinesSlots(beitrag(), 150), 150);
	});

	it("nimmt den Wunsch, wenn der Raum nichts vorgibt", () => {
		assert.equal(plaetzeEinesSlots(beitrag({ maxTeilnehmer: 20 }), undefined), 20);
	});

	it("nimmt das Minimum — der Wunsch ist ein Wunsch, der Raum eine Wand", () => {
		assert.equal(plaetzeEinesSlots(beitrag({ maxTeilnehmer: 20 }), 400), 20);
		assert.equal(plaetzeEinesSlots(beitrag({ maxTeilnehmer: 40 }), 30), 30);
	});
});

describe("plaetzeEinesBlocks", () => {
	const eigene = konferenz({
		tracks: [
			track("t1", "Bühne", { kapazitaet: 400 }),
			track("t2", "Werkstatt", { kapazitaet: 30 }),
		],
		tage: [
			tag("2026-11-04", ["t1", "t2"], [
				block("b1", "09:00", "09:30", { plenar: true }),
				block("b2", "09:30", "10:00", { fix: "Pause" }),
				block("b3", "10:00", "10:45"),
			]),
		],
	});
	const eigenerTag = eigene.tage[0];
	const kapazitaet = (_blockId: string, trackId?: string) =>
		eigene.tracks.find((eigener) => eigener.id === trackId)?.kapazitaet;

	it("zählt die belegten Slots zusammen", () => {
		const beitraege = [
			beitrag({ bloecke: ["b3"], track: "t1" }),
			beitrag({ bloecke: ["b3"], track: "t2", maxTeilnehmer: 20 }),
		];
		const gezaehlt = plaetzeEinesBlocks(eigene, eigenerTag, eigenerTag.bloecke[2], beitraege, kapazitaet);
		assert.equal(gezaehlt.plaetze, 420);
		assert.equal(gezaehlt.frei, 0);
	});

	it("ein leerer Slot zählt nicht mit, sondern als frei", () => {
		const beitraege = [beitrag({ bloecke: ["b3"], track: "t2", maxTeilnehmer: 20 })];
		const gezaehlt = plaetzeEinesBlocks(eigene, eigenerTag, eigenerTag.bloecke[2], beitraege, kapazitaet);
		assert.equal(gezaehlt.plaetze, 20);
		assert.equal(gezaehlt.frei, 1);
	});

	it("ein Beitrag ohne jede Zahl bleibt unbekannt statt null", () => {
		const beitraege = [beitrag({ bloecke: ["b3"], track: "t1" })];
		const gezaehlt = plaetzeEinesBlocks(eigene, eigenerTag, eigenerTag.bloecke[2], beitraege, () => undefined);
		assert.equal(gezaehlt.unbekannt, 1);
		assert.equal(gezaehlt.plaetze, 0);
	});

	it("ein Fixblock hat keine Plätze", () => {
		const gezaehlt = plaetzeEinesBlocks(eigene, eigenerTag, eigenerTag.bloecke[1], [], kapazitaet);
		assert.deepEqual(gezaehlt, { plaetze: 0, unbekannt: 0, frei: 0 });
	});

	it("der plenare Block ist ein Slot, nicht drei", () => {
		const beitraege = [beitrag({ bloecke: ["b1"] })];
		const gezaehlt = plaetzeEinesBlocks(eigene, eigenerTag, eigenerTag.bloecke[0], beitraege, () => 400);
		assert.equal(gezaehlt.plaetze, 400);
		assert.equal(gezaehlt.frei, 0);
	});
});

describe("verwaisteVerweise", () => {
	const konferenzen = [konferenz({ name: "Summit 2026" })];
	const namen = ["Marek Lindqvist"];

	it("schweigt, wenn alles aufgeht", () => {
		const beitraege = [
			beitrag({ konferenz: "Summit 2026", speaker: ["Marek Lindqvist"] }),
		];
		const engagements = [engagement({ konferenz: "Summit 2026", speaker: "Marek Lindqvist" })];
		assert.deepEqual(verwaisteVerweise(beitraege, engagements, konferenzen, namen), []);
	});

	it("findet einen Beitrag, dessen Konferenz es nicht gibt", () => {
		const beitraege = [beitrag({ konferenz: "Summit 2019", speaker: ["Marek Lindqvist"] })];
		const gefunden = verwaisteVerweise(beitraege, [], konferenzen, namen);
		assert.equal(gefunden.length, 1);
		assert.match(gefunden[0].text, /Summit 2019/);
	});

	it("findet einen Speaker, den es im Katalog nicht gibt", () => {
		const beitraege = [beitrag({ konferenz: "Summit 2026", speaker: ["Wer Auchimmer"] })];
		const gefunden = verwaisteVerweise(beitraege, [], konferenzen, namen);
		assert.equal(gefunden.length, 1);
		assert.match(gefunden[0].text, /Wer Auchimmer/);
	});

	it("findet ein Engagement ohne Konferenz", () => {
		const engagements = [engagement({ konferenz: "", speaker: "Marek Lindqvist" })];
		const gefunden = verwaisteVerweise([], engagements, konferenzen, namen);
		assert.deepEqual(gefunden.map((e) => e.text), ["ohne Konferenz"]);
	});

	it("ein Beitrag ohne Speaker ist kein Fehler — das Thema steht, der Mensch fehlt", () => {
		const beitraege = [beitrag({ konferenz: "Summit 2026", titel: "Thema" })];
		assert.deepEqual(verwaisteVerweise(beitraege, [], konferenzen, namen), []);
	});
});

describe("frueherGehalten", () => {
	const konferenzen = [
		konferenz({ name: "Summit 2026", tage: [tag("2026-11-04", [], [])] }),
		konferenz({ name: "Summit 2025", tage: [tag("2025-11-05", [], [])] }),
		konferenz({ name: "Summit 2024", tage: [tag("2024-11-06", [], [])] }),
	];

	const beitraege = [
		beitrag({ konferenz: "Summit 2026", titel: "Von diesem Jahr", speaker: ["Marek"] }),
		beitrag({ konferenz: "Summit 2025", titel: "Von letztem Jahr", speaker: ["Marek"] }),
		beitrag({ konferenz: "Summit 2024", titel: "Von vorletztem Jahr", speaker: ["Marek"] }),
		beitrag({ konferenz: "Summit 2025", titel: "Von jemand anderem", speaker: ["Petra"] }),
		beitrag({ konferenz: "Summit 2025", speaker: ["Marek"] }),
	];

	it("nimmt nur andere Konferenzen — was hier läuft, weiß man selbst", () => {
		const frueher = frueherGehalten("Marek", "Summit 2026", beitraege, konferenzen);
		assert.equal(frueher.some((e) => e.konferenz === "Summit 2026"), false);
	});

	it("die jüngste zuerst", () => {
		const frueher = frueherGehalten("Marek", "Summit 2026", beitraege, konferenzen);
		assert.deepEqual(
			frueher.map((e) => e.titel),
			["Von letztem Jahr", "Von vorletztem Jahr"],
		);
	});

	it("nimmt nur diesen Speaker", () => {
		const frueher = frueherGehalten("Marek", "Summit 2026", beitraege, konferenzen);
		assert.equal(frueher.some((e) => e.titel === "Von jemand anderem"), false);
	});

	it("titellose Beiträge sind kein Vorschlag", () => {
		const frueher = frueherGehalten("Marek", "Summit 2026", beitraege, konferenzen);
		assert.equal(frueher.length, 2);
	});

	it("hört nach der vereinbarten Zahl auf", () => {
		assert.equal(frueherGehalten("Marek", "Summit 2026", beitraege, konferenzen, 1).length, 1);
	});

	it("wer noch nie da war, bekommt keinen Vorschlag", () => {
		assert.deepEqual(frueherGehalten("Neu Hier", "Summit 2026", beitraege, konferenzen), []);
	});
});

describe("verschoben", () => {
	it("schiebt vor und zurück", () => {
		assert.equal(verschoben("09:30", 15), "09:45");
		assert.equal(verschoben("09:30", -45), "08:45");
	});

	it("bleibt innerhalb des Tages", () => {
		assert.equal(verschoben("00:10", -30), "00:00");
		assert.equal(verschoben("23:50", 30), "23:59");
	});

	it("lässt eine fehlende Zeit fehlen", () => {
		assert.equal(verschoben(undefined, 15), undefined);
	});
});

describe("Rollen", () => {
	it("erkennt eine gesetzte Rolle", () => {
		assert.equal(hatRolle(engagement({ rollen: ["moderation"] }), "moderation"), true);
	});

	it("liest tolerant — Großschreibung und Leerraum von Hand", () => {
		assert.equal(hatRolle(engagement({ rollen: [" Moderation "] }), "moderation"), true);
	});

	it("ohne Rollen ist nichts gesetzt", () => {
		assert.equal(hatRolle(engagement(), "moderation"), false);
	});

	it("wer moderiert, wartet auf keinen Slot", () => {
		assert.equal(erwartetBeitrag(engagement({ rollen: ["moderation"] })), false);
	});

	it("wer keine Rolle hat, wird als Kandidat erwartet", () => {
		assert.equal(erwartetBeitrag(engagement()), true);
	});
});

describe("historienbild", () => {
	const laufend = (jahr: string, status = "angefragt") => ({
		konferenz: `Konferenz ${jahr}`,
		datum: `${jahr}-11-04`,
		status,
		konferenzstatus: "planung",
		themen: [],
		bewertung: undefined,
	});
	const vorbei = (jahr: string, bewertung?: number) => ({
		konferenz: `Konferenz ${jahr}`,
		datum: `${jahr}-11-04`,
		status: "bezahlt",
		konferenzstatus: "gelaufen",
		themen: [],
		bewertung,
	});

	it("trennt, was läuft, von dem, was war", () => {
		const bild = historienbild([laufend("2027"), laufend("2026"), vorbei("2025", 2)]);
		assert.equal(bild.laufend.length, 2);
		assert.equal(bild.frueher.length, 1);
	});

	it("eine abgesagte Konferenz ist auch vorbei", () => {
		const abgesagt = { ...vorbei("2024"), konferenzstatus: "abgesagt" };
		assert.equal(historienbild([abgesagt]).frueher.length, 1);
	});

	it("ohne Konferenzstatus gilt eine Konferenz als laufend — nicht stillschweigend als Archiv", () => {
		const ohne = { konferenz: "Irgendwas", status: "gemerkt", themen: [], bewertung: undefined };
		assert.equal(historienbild([ohne]).laufend.length, 1);
		assert.equal(historienbild([ohne]).frueher.length, 0);
	});

	it("mittelt die Noten der früheren", () => {
		assert.equal(historienbild([vorbei("2024", 4), vorbei("2025", 5)]).schnitt, 4.5);
	});

	it("mittelt nur die bewerteten — eine fehlende Note ist keine null", () => {
		assert.equal(historienbild([vorbei("2024", 5), vorbei("2025")]).schnitt, 5);
	});

	it("ohne jede Bewertung bleibt der Schnitt unbekannt", () => {
		assert.equal(historienbild([vorbei("2025")]).schnitt, undefined);
	});

	it("eine Note an einer laufenden Konferenz zieht den Schnitt der früheren nicht", () => {
		const bewertetLaufend = { ...laufend("2026"), bewertung: 1 };
		assert.equal(historienbild([bewertetLaufend, vorbei("2025", 5)]).schnitt, 5);
	});
});
