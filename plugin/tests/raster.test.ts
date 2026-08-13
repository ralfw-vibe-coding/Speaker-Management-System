import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { raumFuer, slotsEinesTages } from "../src/daten/modell";
import { istPlatzhalterName, ohneVerbotene, tageZwischen } from "../src/daten/namen";
import { block, konferenz, tag, track } from "./hilfe";

/**
 * Das Raster und die Namen. Die Zahlen sind dieselben wie in `Demodaten.md`:
 * Tag 1 des Assistenz Summits 2026 hat 19 Slots, davon 15 belegt.
 */

function summit2026() {
	return konferenz({
		name: "Assistenz Summit 2026",
		tracks: [
			track("t1", "Rolle & Zukunft", { raum: "Saal Hanse", kapazitaet: 400 }),
			track("t2", "Werkzeuge & KI", { raum: "Saal Elbe", kapazitaet: 150 }),
			track("t3", "Praxis-Workshops", { raum: "Raum Speicher", kapazitaet: 30 }),
		],
		tage: [
			tag("2026-11-04", ["t1", "t2", "t3"], [
				block("b1", "09:00", "09:30", { plenar: true }),
				block("b2", "09:30", "10:00", { fix: "Ankommen & Kaffee" }),
				block("b3", "10:00", "10:45"),
				block("b4", "10:45", "11:00", { fix: "Pause" }),
				block("b5", "11:00", "11:45"),
				block("b6", "11:45", "12:00", { fix: "Pause" }),
				block("b7", "12:00", "12:45"),
				block("b8", "12:45", "14:00", { fix: "Mittagspause" }),
				block("b9", "14:00", "14:45"),
				block("b10", "14:45", "15:00", { fix: "Pause" }),
				block("b11", "15:00", "15:45"),
				block("b12", "15:45", "16:00", { fix: "Pause" }),
				block("b13", "16:00", "16:45"),
			]),
		],
		slots: [
			{ block: "b1", raum: "Saal Hanse", kapazitaet: 400 },
			{ block: "b9", track: "t3", raum: "Raum Werft", kapazitaet: 20 },
		],
	});
}

describe("slotsEinesTages", () => {
	it("zählt Kreuzprodukt minus Fixblöcke, plenar als einen — 19 wie im Vault", () => {
		const eigene = summit2026();
		const gezaehlt = slotsEinesTages(eigene, eigene.tage[0], () => false);
		assert.equal(gezaehlt.gesamt, 19);
		assert.equal(gezaehlt.belegt, 0);
	});

	it("zählt Belegtes mit", () => {
		const eigene = summit2026();
		const gezaehlt = slotsEinesTages(eigene, eigene.tage[0], (blockId) => blockId === "b1");
		assert.equal(gezaehlt.belegt, 1);
	});

	it("`nur` schränkt die Zeile auf einen Track ein", () => {
		const eigene = konferenz({
			tracks: [track("t1", "A"), track("t2", "B")],
			tage: [tag("2026-11-04", ["t1", "t2"], [block("b1", "13:00", "16:00", { nur: ["t2"] })])],
		});
		assert.equal(slotsEinesTages(eigene, eigene.tage[0], () => false).gesamt, 1);
	});
});

describe("raumFuer", () => {
	const eigene = summit2026();

	it("nimmt den Raum des Tracks, wenn nichts abweicht", () => {
		const ort = raumFuer(eigene, "b3", "t3");
		assert.equal(ort.raum, "Raum Speicher");
		assert.equal(ort.kapazitaet, 30);
		assert.equal(ort.abweichend, false);
	});

	it("der Slot-Eintrag gewinnt gegen den Track", () => {
		const ort = raumFuer(eigene, "b9", "t3");
		assert.equal(ort.raum, "Raum Werft");
		assert.equal(ort.kapazitaet, 20);
		assert.equal(ort.abweichend, true);
	});

	it("der Eintrag ohne Track deckt den plenaren Slot ab, der von keinem erbt", () => {
		const ort = raumFuer(eigene, "b1");
		assert.equal(ort.raum, "Saal Hanse");
		assert.equal(ort.abweichend, true);
	});

	it("ohne alles bleibt der Raum offen — das ist kein Fehler", () => {
		const leer = konferenz({ tracks: [track("t1", "A")] });
		assert.equal(raumFuer(leer, "b1", "t1").raum, undefined);
	});
});

describe("tageZwischen", () => {
	it("ohne Datum keine Tage — dann ist die Konferenz eine Idee", () => {
		assert.deepEqual(tageZwischen(undefined), []);
	});

	it("ohne Enddatum ein Tag", () => {
		assert.deepEqual(tageZwischen("2026-11-04"), ["2026-11-04"]);
	});

	it("zählt beide Enden mit", () => {
		assert.deepEqual(tageZwischen("2026-11-04", "2026-11-06"), [
			"2026-11-04",
			"2026-11-05",
			"2026-11-06",
		]);
	});

	it("zählt über den Monatswechsel", () => {
		assert.deepEqual(tageZwischen("2026-10-31", "2026-11-01"), ["2026-10-31", "2026-11-01"]);
	});

	it("ein Ende vor dem Anfang ergibt nichts", () => {
		assert.deepEqual(tageZwischen("2026-11-06", "2026-11-04"), []);
	});

	it("hört bei vierzehn Tagen auf — darüber ist eher das Jahr vertippt", () => {
		assert.equal(tageZwischen("2026-11-04", "2027-11-04").length, 14);
	});
});

describe("Namen", () => {
	it("bereinigt die Zeichen, die Obsidian verbietet", () => {
		assert.equal(ohneVerbotene("Workshop: Der perfekte Board-Report"), "Workshop Der perfekte Board-Report");
		assert.equal(ohneVerbotene("A/B * C?"), "AB  C");
	});

	it("erkennt einen Platzhalternamen", () => {
		assert.equal(
			istPlatzhalterName("Assistenz Summit 2026 – Beitrag Mi 12 Uhr Track B", "Assistenz Summit 2026"),
			true,
		);
	});

	it("lässt einen selbst gewählten Namen in Ruhe", () => {
		assert.equal(
			istPlatzhalterName("Assistenz Summit 2026 – Macht ohne Titel", "Assistenz Summit 2026"),
			false,
		);
	});
});
