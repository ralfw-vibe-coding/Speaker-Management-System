import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { geruest, namen, SCHEMATA, schemaFuer, SCHEMA_VERSION } from "../src/daten/schema";
import { ergaenzen, fehlendeAbschnitte, fehlendeFelder } from "../src/daten/migration";
import datenmodell from "../src/vaultdoku/sms-datenmodell.md";

/**
 * Die Feldliste ist die eine Quelle. Diese Tests halten fest, was daraus
 * folgen muss — und dass die ausgelieferte Doku nichts auslässt.
 */

describe("Schema", () => {
	it("kennt die fünf Notiztypen", () => {
		assert.deepEqual(
			SCHEMATA.map((s) => s.typ).sort(),
			["beitrag", "engagement", "konferenz", "speaker", "veranstalter"],
		);
	});

	it("findet ein Schema über seinen Typ", () => {
		assert.equal(schemaFuer("speaker")?.titel, "Speaker");
		assert.equal(schemaFuer("gibtsnicht"), undefined);
	});

	it("nennt bei jedem Feld den heutigen Namen zuerst", () => {
		for (const schema of SCHEMATA) {
			for (const feld of schema.felder) assert.equal(namen(feld)[0], feld.name);
		}
	});

	it("sagt bei jedem Zahlenfeld, wie ein fehlender Wert zu rechnen ist", () => {
		// Sonst entscheidet es jede Auswertung neu — und irgendwann sieht eine
		// Lücke im Wissen aus wie eine Null.
		for (const schema of SCHEMATA) {
			for (const feld of schema.felder) {
				if (feld.art !== "zahl") continue;
				assert.ok(feld.fehlend, `${schema.typ}.${feld.name} sagt nichts über fehlende Werte`);
			}
		}
	});

	it("hat eine Schemaversion", () => {
		assert.ok(Number.isInteger(SCHEMA_VERSION) && SCHEMA_VERSION >= 1);
	});
});

describe("geruest", () => {
	const speaker = schemaFuer("speaker")!;

	it("beginnt mit dem Typ", () => {
		assert.ok(geruest(speaker).startsWith("---\ntype: speaker\n"));
	});

	it("schreibt Listen als leere Liste, alles andere als leeren Wert", () => {
		const text = geruest(speaker);
		assert.ok(text.includes("themen: []"));
		assert.ok(text.includes("rolle:\n"));
	});

	it("lässt weg, was nicht ins Gerüst gehört", () => {
		assert.equal(geruest(speaker).includes("wahl:"), false);
	});

	it("übernimmt Vorgaben", () => {
		const text = geruest(schemaFuer("engagement")!, { status: "gemerkt", position: "3" });
		assert.ok(text.includes("status: gemerkt"));
		assert.ok(text.includes("position: 3"));
	});

	it("bringt die Abschnitte des Bodys mit, Checklisten samt Punkten", () => {
		const text = geruest(schemaFuer("engagement")!);
		assert.ok(text.includes("## Zu klären"));
		assert.ok(text.includes("- [ ] Bio erhalten"));
		assert.ok(text.includes("## Gesprächsnotizen"));
	});
});

describe("fehlende Felder und Abschnitte", () => {
	const speaker = schemaFuer("speaker")!;

	it("findet, was eine ältere Notiz nicht kennt", () => {
		const alt = { type: "speaker", rolle: "Beraterin", themen: ["ki"] };
		const fehlt = fehlendeFelder(speaker, alt);
		assert.ok(fehlt.includes("foto"));
		assert.ok(fehlt.includes("zielgruppe"));
		assert.equal(fehlt.includes("rolle"), false);
	});

	it("zählt ein leeres Feld als vorhanden — leer ist eine Aussage", () => {
		assert.equal(fehlendeFelder(speaker, { type: "speaker", foto: null }).includes("foto"), false);
	});

	it("verlangt nichts, was nicht ins Gerüst gehört", () => {
		assert.equal(fehlendeFelder(speaker, { type: "speaker" }).includes("wahl"), false);
	});

	it("findet fehlende Abschnitte", () => {
		assert.deepEqual(fehlendeAbschnitte(speaker, ["Profil", "Notizen"]), ["Bio"]);
		assert.deepEqual(fehlendeAbschnitte(speaker, ["Bio", "Profil", "Notizen"]), []);
	});
});

describe("Die ausgelieferte Doku", () => {
	it("nennt jedes Feld aus dem Schema", () => {
		// Ohne diese Prüfung fällt beim nächsten neuen Feld die Doku hinten
		// herunter — genau so ist es bei `foto` und `reisekosten` passiert.
		for (const schema of SCHEMATA) {
			for (const feld of schema.felder) {
				assert.ok(
					datenmodell.includes(`\`${feld.name}\``),
					`sms-datenmodell.md erwähnt ${schema.typ}.${feld.name} nicht`,
				);
			}
		}
	});
});

describe("ergaenzen", () => {
	const notiz = ["---", "type: speaker", "themen: [ki, prompting]", "---", "## Profil", "Ein Satz.", ""].join(
		"\n",
	);

	it("schiebt die Feldzeilen vor das schließende ---", () => {
		const neu = ergaenzen(notiz, ["foto:", "zielgruppe: []"], []);
		assert.equal(
			neu.split("\n").slice(0, 6).join("\n"),
			["---", "type: speaker", "themen: [ki, prompting]", "foto:", "zielgruppe: []", "---"].join("\n"),
		);
	});

	it("lässt vorhandene Zeilen Zeichen für Zeichen, wie sie sind", () => {
		// Das ist der ganze Grund für den Texteinschub: Über Obsidians API
		// würde aus der Flow-Liste eine mehrzeilige.
		assert.ok(ergaenzen(notiz, ["foto:"], []).includes("themen: [ki, prompting]"));
	});

	it("hängt fehlende Abschnitte hinten an, samt ihrer Punkte", () => {
		const neu = ergaenzen(notiz, [], [{ titel: "Zu klären", zeilen: ["- [ ] Bio erhalten"] }]);
		assert.ok(neu.includes("## Zu klären\n- [ ] Bio erhalten"));
		assert.ok(neu.indexOf("## Profil") < neu.indexOf("## Zu klären"));
	});

	it("ändert nichts, wenn nichts fehlt", () => {
		assert.equal(ergaenzen(notiz, [], []), notiz);
	});

	it("lässt eine Notiz ohne Frontmatter in Ruhe", () => {
		const ohne = "# Nur Text\n";
		assert.equal(ergaenzen(ohne, ["foto:"], []), ohne);
	});
});
