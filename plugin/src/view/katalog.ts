import { Notice, type TFile } from "obsidian";
import type { Datenzugriff } from "../daten/lesen";
import type { Datenschreiber } from "../daten/schreiben";
import { historienbild } from "../daten/projektion";
import {
	FORMATE,
	FORMAT_TITEL,
	FUNNEL_TITEL,
	type Auftritt,
	type Engagement,
	type Konferenz,
	type Speaker,
} from "../daten/modell";

function naechsteStufe(bisher: number | undefined): number | undefined {
	if (bisher === undefined) return 1;
	return bisher >= 3 ? undefined : bisher + 1;
}

function beschriftung(stufe: number | undefined): string {
	return stufe === undefined ? "nicht eingeschätzt" : `${stufe}. Wahl`;
}

/** Was der Katalog über einen Speaker zeigt — Notiz plus gerechnete Historie. */
interface Eintrag {
	speaker: Speaker;
	historie: Auftritt[];
}

/**
 * Der Speakerkatalog: konferenzübergreifend, lesend. Alles auf einer Karte ist
 * entweder ein Feld aus der Notiz oder aus den Engagements gerechnet, die auf
 * den Speaker zeigen. Gespeichert wird davon nichts.
 */
export class Speakerkatalog {
	private suche = "";
	private formate = new Set<string>();
	private sprachen = new Set<string>();
	private zielgruppen = new Set<string>();
	private wahlstufen = new Set<number>();

	/** Die Konferenz, für die gemerkt wird — dieselbe wie in den anderen Sichten. */
	private konferenz: Konferenz | undefined;
	private engagements: Engagement[] = [];

	/** Speaker, deren frühere Auftritte gerade ausgeklappt sind. */
	private aufgeklappt = new Set<string>();
	private buehne: HTMLElement | undefined;

	constructor(
		private daten: Datenzugriff,
		private schreiber: Datenschreiber,
		private notizOeffnen: (datei: TFile) => void,
		private speakerAnlegen: (vorhandene: Speaker[]) => void,
	) {}

	async zeichnen(buehne: HTMLElement, konferenz?: Konferenz): Promise<void> {
		this.buehne = buehne;
		this.konferenz = konferenz;
		const eintraege = await this.lesen();

		buehne.empty();
		buehne.addClass("sms-katalog");

		const gefiltert = eintraege.filter((e) => this.passt(e));

		this.leisteZeichnen(buehne, eintraege, gefiltert.length);

		if (eintraege.length === 0) {
			buehne.createEl("p", {
				cls: "sms-leer",
				text:
					"Keine Notizen mit „type: speaker“ gefunden. " +
					"Stimmt der Speakerordner in den Einstellungen?",
			});
			return;
		}

		if (gefiltert.length === 0) {
			buehne.createEl("p", { cls: "sms-leer", text: "Kein Speaker passt zu diesen Filtern." });
			return;
		}

		const liste = buehne.createDiv({ cls: "sms-karten" });
		for (const eintrag of gefiltert) this.karteZeichnen(liste, eintrag);
	}

	/**
	 * Neu zeichnen und dabei die ausgewählte Konferenz behalten. `zeichnen`
	 * ohne zweites Argument setzte sie auf „keine" — dann verschwände das
	 * „merken" von allen Karten, sobald man etwas anderes anklickt.
	 */
	private neuZeichnen(): void {
		if (this.buehne) void this.zeichnen(this.buehne, this.konferenz);
	}

	// ---------------------------------------------------------------- Daten

	private async lesen(): Promise<Eintrag[]> {
		const speaker = await this.daten.speaker();
		const engagements = this.daten.engagements();
		const konferenzen = new Map(this.daten.konferenzen().map((k) => [k.name, k]));
		this.engagements = engagements;

		// Womit jemand wo aufgetreten ist — nach Speaker und Konferenz abgelegt,
		// damit die Zuordnung unten nicht über alle Beiträge laufen muss. Der
		// senkrechte Strich trennt sicher: In Dateinamen ist er verboten, kann
		// also in keinem der beiden Namen vorkommen.
		const themen = new Map<string, { titel: string; datei: TFile }[]>();
		for (const beitrag of this.daten.beitraege()) {
			if (!beitrag.titel) continue;
			for (const name of beitrag.speaker) {
				const schluessel = `${name}|${beitrag.konferenz}`;
				const eintrag = { titel: beitrag.titel, datei: beitrag.datei };
				const bisher = themen.get(schluessel);
				if (bisher) bisher.push(eintrag);
				else themen.set(schluessel, [eintrag]);
			}
		}

		const historien = new Map<string, Auftritt[]>();
		for (const engagement of engagements) {
			if (!engagement.speaker) continue;
			const konferenz = konferenzen.get(engagement.konferenz);
			const auftritt: Auftritt = {
				konferenz: engagement.konferenz,
				konferenzDatei: konferenz?.datei,
				datum: konferenz?.tage[0]?.datum,
				status: engagement.status,
				konferenzstatus: konferenz?.status,
				themen: themen.get(`${engagement.speaker}|${engagement.konferenz}`) ?? [],
				bewertung: engagement.bewertung,
			};
			const bisher = historien.get(engagement.speaker);
			if (bisher) bisher.push(auftritt);
			else historien.set(engagement.speaker, [auftritt]);
		}

		// Die jüngste Konferenz zuerst; ohne Datum ans Ende, alphabetisch.
		for (const historie of historien.values()) {
			historie.sort((a, b) => {
				if (a.datum && b.datum) return b.datum.localeCompare(a.datum);
				if (a.datum) return -1;
				if (b.datum) return 1;
				return a.konferenz.localeCompare(b.konferenz, "de");
			});
		}

		return speaker.map((s) => ({ speaker: s, historie: historien.get(s.name) ?? [] }));
	}

	private passt(eintrag: Eintrag): boolean {
		const { speaker } = eintrag;

		if (this.suche) {
			const heuhaufen = [
				speaker.name,
				speaker.rolle ?? "",
				speaker.ort ?? "",
				speaker.notiz ?? "",
				speaker.bio ?? "",
				...speaker.themen,
				...speaker.zielgruppen,
			]
				.join(" ")
				.toLowerCase();
			if (!heuhaufen.includes(this.suche)) return false;
		}

		// Mehrere Häkchen in einer Zeile sind ein Oder, zwischen den Zeilen ein Und.
		if (this.formate.size > 0 && !speaker.formate.some((f) => this.formate.has(f))) return false;
		if (this.sprachen.size > 0 && !speaker.sprachen.some((s) => this.sprachen.has(s))) return false;
		if (
			this.zielgruppen.size > 0 &&
			!speaker.zielgruppen.some((z) => this.zielgruppen.has(z))
		) {
			return false;
		}
		if (this.wahlstufen.size > 0) {
			const stufen = [...speaker.wahl.values()];
			if (!stufen.some((stufe) => this.wahlstufen.has(stufe))) return false;
		}

		return true;
	}

	// -------------------------------------------------------------- Zeichnen

	private leisteZeichnen(buehne: HTMLElement, alle: Eintrag[], sichtbar: number): void {
		const leiste = buehne.createDiv({ cls: "sms-leiste" });

		const suchfeld = leiste.createEl("input", {
			cls: "sms-suche",
			attr: { type: "search", placeholder: "Name, Rolle, Thema, Ort …" },
		});
		suchfeld.value = this.suche;
		suchfeld.addEventListener("input", () => {
			this.suche = suchfeld.value.trim().toLowerCase();
			void this.zeichnen(buehne, this.konferenz).then(() => {
				// Nach dem Neuzeichnen steht der Cursor sonst nicht mehr im Suchfeld.
				const neu = buehne.querySelector<HTMLInputElement>(".sms-suche");
				neu?.focus();
				neu?.setSelectionRange(neu.value.length, neu.value.length);
			});
		});

		leiste.createSpan({
			cls: "sms-zaehler",
			text: sichtbar === alle.length ? `${alle.length} Speaker` : `${sichtbar} von ${alle.length}`,
		});

		const anlegen = leiste.createEl("button", { cls: "sms-anlegen mod-cta", text: "+ Speaker" });
		anlegen.addEventListener("click", () => this.speakerAnlegen(alle.map((e) => e.speaker)));

		const filter = buehne.createDiv({ cls: "sms-filter" });

		this.filterzeile(
			filter,
			"Format",
			FORMATE.map((f) => ({ wert: f, titel: FORMAT_TITEL[f] })),
			this.formate,
			buehne,
		);

		const sprachen = [...new Set(alle.flatMap((e) => e.speaker.sprachen))].sort();
		this.filterzeile(
			filter,
			"Sprache",
			sprachen.map((s) => ({ wert: s, titel: s })),
			this.sprachen,
			buehne,
		);

		const zielgruppen = [...new Set(alle.flatMap((e) => e.speaker.zielgruppen))].sort();
		this.filterzeile(
			filter,
			"Zielgruppe",
			zielgruppen.map((z) => ({ wert: z, titel: z })),
			this.zielgruppen,
			buehne,
		);

		const wahlzeile = filter.createDiv({ cls: "sms-filterzeile" });
		wahlzeile.createSpan({ cls: "sms-filtertitel", text: "Wahl" });
		for (const stufe of [1, 2, 3]) {
			const aktiv = this.wahlstufen.has(stufe);
			const knopf = wahlzeile.createEl("button", {
				cls: aktiv ? "sms-chip is-aktiv" : "sms-chip",
				text: `${stufe}. Wahl`,
			});
			knopf.addEventListener("click", () => {
				if (aktiv) this.wahlstufen.delete(stufe);
				else this.wahlstufen.add(stufe);
				this.neuZeichnen();
			});
		}
	}

	private filterzeile(
		eltern: HTMLElement,
		titel: string,
		werte: { wert: string; titel: string }[],
		gewaehlt: Set<string>,
		buehne: HTMLElement,
	): void {
		if (werte.length === 0) return;

		const zeile = eltern.createDiv({ cls: "sms-filterzeile" });
		zeile.createSpan({ cls: "sms-filtertitel", text: titel });

		for (const { wert, titel: beschriftung } of werte) {
			const aktiv = gewaehlt.has(wert);
			const knopf = zeile.createEl("button", {
				cls: aktiv ? "sms-chip is-aktiv" : "sms-chip",
				text: beschriftung,
			});
			knopf.addEventListener("click", () => {
				if (aktiv) gewaehlt.delete(wert);
				else gewaehlt.add(wert);
				this.neuZeichnen();
			});
		}
	}

	/**
	 * „Als Kandidat für ⟨Konferenz⟩ merken" — nur, wenn es ihn dort noch nicht
	 * gibt. Wer schon dabei ist, steht ohnehin in seiner Historie.
	 */
	private merkenAnbieten(karte: HTMLElement, speaker: Speaker, historie: Auftritt[]): void {
		const konferenz = this.konferenz;
		if (!konferenz) return;
		if (historie.some((auftritt) => auftritt.konferenz === konferenz.name)) return;

		const knopf = karte.createEl("button", {
			cls: "sms-chip sms-merken",
			text: "merken",
			attr: { title: `Als Kandidat für ${konferenz.name} merken` },
		});
		knopf.addEventListener("click", (ereignis) => {
			// Sonst öffnet der Klick zusätzlich die Speakernotiz.
			ereignis.stopPropagation();
			void this.merken(speaker, konferenz);
		});
	}

	/** 1 → 2 → 3 → nicht eingeschätzt → 1. */
	private async wahlWeiterschalten(
		speaker: Speaker,
		thema: string,
		bisher: number | undefined,
	): Promise<void> {
		try {
			await this.schreiber.wahlSetzen(speaker.datei, thema, naechsteStufe(bisher));
		} catch (fehler) {
			new Notice(`Die Wahl ließ sich nicht setzen: ${String(fehler)}`);
		}
	}

	private async merken(speaker: Speaker, konferenz: Konferenz): Promise<void> {
		// Hinten anhängen: Eine aufgebaute Ordnung soll nicht von oben zerdrückt werden.
		const position = this.engagements
			.filter((e) => e.konferenz === konferenz.name && e.status === "gemerkt")
			.reduce((groesste, e) => Math.max(groesste, e.position + 1), 0);

		try {
			await this.schreiber.engagementAnlegen(konferenz, speaker.name, position);
			new Notice(`${speaker.name} ist Kandidat für ${konferenz.name}.`);
		} catch (fehler) {
			new Notice(`Der Kandidat ließ sich nicht anlegen: ${String(fehler)}`);
		}
	}

	private karteZeichnen(liste: HTMLElement, { speaker, historie }: Eintrag): void {
		const karte = liste.createDiv({ cls: "sms-karte" });
		karte.addEventListener("click", () => this.notizOeffnen(speaker.datei));

		// Ein Gesicht findet man schneller als einen Namen. Wo keines hinterlegt
		// ist, bleibt die Zeile ohne Platzhalter — leer sagt mehr als eine
		// graue Silhouette.
		const oben = karte.createDiv({ cls: "sms-speakerzeile" });
		if (speaker.fotoQuelle) {
			oben.createEl("img", {
				cls: "sms-foto",
				attr: { src: speaker.fotoQuelle, alt: speaker.name },
			});
		}

		const angaben = oben.createDiv({ cls: "sms-speakerangaben" });
		const kopf = angaben.createDiv({ cls: "sms-karte-kopf" });
		kopf.createSpan({ cls: "sms-name", text: speaker.name });
		if (speaker.ort) kopf.createSpan({ cls: "sms-ort", text: speaker.ort });

		if (speaker.rolle) angaben.createDiv({ cls: "sms-rolle", text: speaker.rolle });
		if (speaker.bio) angaben.createDiv({ cls: "sms-bio", text: speaker.bio });

		if (speaker.themen.length > 0 || speaker.wahl.size > 0) {
			const themen = karte.createDiv({ cls: "sms-themen" });
			for (const thema of speaker.themen) {
				const wahl = speaker.wahl.get(thema);
				const chip = themen.createSpan({
					cls: wahl ? `sms-thema sms-wahl-${wahl}` : "sms-thema",
					attr: { title: `Klick: ${beschriftung(naechsteStufe(wahl))}` },
				});
				chip.createSpan({ text: thema });
				if (wahl) chip.createSpan({ cls: "sms-wahl", text: `${wahl}.` });

				// Die Wahl ist das Einzige am Speaker, das man laufend ändert —
				// dafür soll niemand ins Frontmatter müssen.
				chip.addEventListener("click", (ereignis) => {
					ereignis.stopPropagation();
					void this.wahlWeiterschalten(speaker, thema, wahl);
				});
			}

			// Eine Wahl zu einem Thema, das nicht in `themen` steht — im Konzept
			// unter „Was das Plugin prüft, ohne dass man fragt".
			for (const thema of speaker.wahl.keys()) {
				if (speaker.themen.includes(thema)) continue;
				themen.createSpan({ cls: "sms-thema sms-warnung", text: `⚠ ${thema} fehlt in themen` });
			}
		}

		// Die Zielgruppen stehen bewusst nicht auf der Karte: Sie sind ein Filter,
		// keine Anzeige. Ist er gesetzt, tragen alle sichtbaren Karten dieselben
		// Chips und sagen nichts; ist er es nicht, fragt gerade niemand danach.

		// Formate und Sprachen stehen wie die Zielgruppen nur noch in der
		// Filterleiste. Was der Filter beantwortet, muss die Karte nicht wiederholen.
		if (speaker.honorarrahmen !== undefined) {
			const zeile = karte.createDiv({ cls: "sms-zeile" });
			zeile.createSpan({ text: `ab ${speaker.honorarrahmen.toLocaleString("de-DE")} €` });
		}

		// Die erste Notizzeile stand hier früher als Vorschau. Sie war die längste
		// Zeile der Karte, machte jede Karte unterschiedlich hoch — und half bei
		// der einen Frage nicht, die man beim Blättern stellt: Wer passt hier?
		// Sie steht in der Notiz, die ein Klick auf die Karte öffnet.

		this.merkenAnbieten(karte, speaker, historie);

		this.historieZeichnen(karte, historie, speaker.name);
	}

	/**
	 * Die Historie: was läuft, steht einzeln mit seinem Status — dort wartet
	 * etwas. Was gelaufen ist, wird zu einer Zeile gezählt; sein Funnel-Status
	 * ist immer derselbe, interessant ist die Bewertung. So wächst die Karte
	 * nur mit dem, was offen ist, und nicht mit den Jahren.
	 */
	private historieZeichnen(karte: HTMLElement, historie: Auftritt[], name: string): void {
		if (historie.length === 0) return;

		const bild = historienbild(historie);
		const spur = karte.createDiv({ cls: "sms-historie" });

		for (const auftritt of bild.laufend) {
			const zeile = spur.createDiv({ cls: "sms-auftritt" });
			zeile.createSpan({ cls: "sms-auftritt-name", text: auftritt.konferenz });
			zeile.createSpan({
				cls: `sms-status sms-status-${auftritt.status}`,
				text: FUNNEL_TITEL[auftritt.status] ?? auftritt.status,
			});
			if (auftritt.bewertung !== undefined) {
				zeile.createSpan({
					cls: "sms-sterne",
					text: "★".repeat(auftritt.bewertung) + "☆".repeat(Math.max(0, 5 - auftritt.bewertung)),
				});
			}
		}

		if (bild.frueher.length === 0) return;

		const offen = this.aufgeklappt.has(name);
		const zeile = spur.createDiv({ cls: "sms-frueher" });
		zeile.createSpan({ cls: "sms-pfeil", text: offen ? "▾" : "▸" });
		zeile.createSpan({
			text: bild.frueher.length === 1 ? "1 früher" : `${bild.frueher.length} früher`,
		});

		if (bild.schnitt !== undefined) {
			const volle = Math.round(bild.schnitt);
			zeile.createSpan({
				cls: "sms-sterne",
				text: "★".repeat(volle) + "☆".repeat(Math.max(0, 5 - volle)),
				attr: { title: `${bild.schnitt.toFixed(1)} von 5 im Mittel` },
			});
		}

		// Der Klick klappt auf, statt die Notiz zu öffnen — die Karte selbst tut
		// das ja schon.
		zeile.addEventListener("click", (ereignis) => {
			ereignis.stopPropagation();
			if (offen) this.aufgeklappt.delete(name);
			else this.aufgeklappt.add(name);
			this.neuZeichnen();
		});

		if (!offen) return;

		// Womit jemand da war, ist der Grund, warum der Katalog über die Jahre
		// geht: Man bucht niemanden zweimal mit demselben Thema. Deshalb steht
		// der Titel in einer eigenen Zeile und wird nicht abgeschnitten —
		// abgeschnitten wäre er genau die Angabe, wegen der man aufklappt.
		for (const auftritt of bild.frueher) {
			const eintrag = spur.createDiv({ cls: "sms-frueher-eintrag" });

			const kopf = eintrag.createDiv({ cls: "sms-frueher-kopf" });
			const konferenzname = kopf.createSpan({ cls: "sms-auftritt-name", text: auftritt.konferenz });
			if (auftritt.konferenzDatei) {
				const datei = auftritt.konferenzDatei;
				konferenzname.addClass("is-anklickbar");
				konferenzname.addEventListener("click", (ereignis) => {
					ereignis.stopPropagation();
					this.notizOeffnen(datei);
				});
			}
			if (auftritt.bewertung !== undefined) {
				kopf.createSpan({
					cls: "sms-sterne",
					text: "★".repeat(auftritt.bewertung) + "☆".repeat(Math.max(0, 5 - auftritt.bewertung)),
				});
			}

			if (auftritt.themen.length === 0) {
				eintrag.createDiv({ cls: "sms-frueher-thema is-leer", text: "ohne Thema" });
				continue;
			}

			for (const thema of auftritt.themen) {
				const zeile = eintrag.createDiv({ cls: "sms-frueher-thema", text: thema.titel });
				// Der Klick öffnet den Beitrag von damals, nicht den Speaker — den
				// hat man ja gerade vor sich. Ohne das Anhalten übernähme die Karte.
				zeile.addEventListener("click", (ereignis) => {
					ereignis.stopPropagation();
					this.notizOeffnen(thema.datei);
				});
			}
		}
	}
}
