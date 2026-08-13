import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { linkName, liste, text, zahl, zuordnung } from "../src/daten/felder";

/**
 * „Eng schreiben, tolerant lesen." Diese Tests halten die zweite Hälfte fest:
 * Ein fehlendes Feld ist kein Fehler, ein falsches macht das Feld leer.
 */

describe("text", () => {
	it("gibt getrimmten Text zurück", () => {
		assert.equal(text("  Hamburg "), "Hamburg");
	});

	it("macht aus einer Zahl Text — YAML liest 2026 als Zahl", () => {
		assert.equal(text(2026), "2026");
	});

	it("verwirft Leeres, Fehlendes und Falsches", () => {
		assert.equal(text("   "), undefined);
		assert.equal(text(undefined), undefined);
		assert.equal(text(null), undefined);
		assert.equal(text(["a"]), undefined);
	});
});

describe("zahl", () => {
	it("nimmt Zahlen und Zahlen als Text", () => {
		assert.equal(zahl(1500), 1500);
		assert.equal(zahl("1500"), 1500);
	});

	it("verwirft, was keine Zahl ist", () => {
		assert.equal(zahl("bald"), undefined);
		assert.equal(zahl(undefined), undefined);
		assert.equal(zahl(Number.NaN), undefined);
	});
});

describe("liste", () => {
	it("nimmt eine Liste", () => {
		assert.deepEqual(liste(["de", "en"]), ["de", "en"]);
	});

	it("nimmt einen einzelnen Wert — so darf `block` einer oder mehrere sein", () => {
		assert.deepEqual(liste("b3"), ["b3"]);
	});

	it("ist bei nichts leer, nicht kaputt", () => {
		assert.deepEqual(liste(undefined), []);
		assert.deepEqual(liste(null), []);
	});

	it("wirft unbrauchbare Einträge weg, behält die brauchbaren", () => {
		assert.deepEqual(liste(["de", null, "  ", "en"]), ["de", "en"]);
	});
});

describe("zuordnung", () => {
	it("liest die Wahl je Thema", () => {
		const wahl = zuordnung({ ki: 1, werkzeuge: 2 });
		assert.equal(wahl.get("ki"), 1);
		assert.equal(wahl.get("werkzeuge"), 2);
	});

	it("überspringt Einträge ohne Zahl", () => {
		const wahl = zuordnung({ ki: 1, führung: "vielleicht" });
		assert.equal(wahl.size, 1);
	});

	it("verträgt eine Liste an dieser Stelle, statt sich zu verschlucken", () => {
		assert.equal(zuordnung(["ki"]).size, 0);
		assert.equal(zuordnung(undefined).size, 0);
	});
});

describe("linkName", () => {
	it("löst einen Wikilink auf", () => {
		assert.equal(linkName("[[Petra Vahlbruch]]"), "Petra Vahlbruch");
	});

	it("nimmt den Dateinamen, nicht den Pfad — so löst Obsidian auf", () => {
		assert.equal(linkName("[[speaker/Petra Vahlbruch]]"), "Petra Vahlbruch");
	});

	it("wirft den Alias weg", () => {
		assert.equal(linkName("[[Petra Vahlbruch|Petra]]"), "Petra Vahlbruch");
	});

	it("verträgt einen blanken Namen ohne Klammern", () => {
		assert.equal(linkName("Petra Vahlbruch"), "Petra Vahlbruch");
	});

	it("ist bei nichts undefiniert", () => {
		assert.equal(linkName(undefined), undefined);
		assert.equal(linkName(""), undefined);
	});
});
