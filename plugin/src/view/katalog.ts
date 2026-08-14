import { Notice, type TFile } from "obsidian";
import type { Datenzugriff } from "../daten/lesen";
import type { Datenschreiber } from "../daten/schreiben";
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

	constructor(
		private daten: Datenzugriff,
		private schreiber: Datenschreiber,
		private notizOeffnen: (datei: TFile) => void,
		private speakerAnlegen: (vorhandene: Speaker[]) => void,
	) {}

	async zeichnen(buehne: HTMLElement, konferenz?: Konferenz): Promise<void> {
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

	// ---------------------------------------------------------------- Daten

	private async lesen(): Promise<Eintrag[]> {
		const speaker = await this.daten.speaker();
		const engagements = this.daten.engagements();
		const konferenzen = new Map(this.daten.konferenzen().map((k) => [k.name, k]));
		this.engagements = engagements;

		const historien = new Map<string, Auftritt[]>();
		for (const engagement of engagements) {
			if (!engagement.speaker) continue;
			const konferenz = konferenzen.get(engagement.konferenz);
			const auftritt: Auftritt = {
				konferenz: engagement.konferenz,
				konferenzDatei: konferenz?.datei,
				datum: konferenz?.tage[0]?.datum,
				status: engagement.status,
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
			void this.zeichnen(buehne).then(() => {
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
				void this.zeichnen(buehne);
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
				void this.zeichnen(buehne);
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

		if (speaker.zielgruppen.length > 0) {
			const fuer = karte.createDiv({ cls: "sms-themen" });
			for (const zielgruppe of speaker.zielgruppen) {
				fuer.createSpan({ cls: "sms-thema sms-zielgruppe", text: `für ${zielgruppe}` });
			}
		}

		const zeile = karte.createDiv({ cls: "sms-zeile" });
		if (speaker.formate.length > 0) {
			zeile.createSpan({
				text: speaker.formate.map((f) => FORMAT_TITEL[f] ?? f).join(" · "),
			});
		}
		if (speaker.sprachen.length > 0) zeile.createSpan({ text: speaker.sprachen.join("/") });
		if (speaker.honorarrahmen !== undefined) {
			zeile.createSpan({ text: `ab ${speaker.honorarrahmen.toLocaleString("de-DE")} €` });
		}

		if (speaker.notiz) karte.createDiv({ cls: "sms-notiz", text: `„${speaker.notiz}"` });

		this.merkenAnbieten(karte, speaker, historie);

		if (historie.length > 0) {
			const spur = karte.createDiv({ cls: "sms-historie" });
			for (const auftritt of historie) {
				const auftrittZeile = spur.createDiv({ cls: "sms-auftritt" });
				auftrittZeile.createSpan({ cls: "sms-auftritt-name", text: auftritt.konferenz });
				auftrittZeile.createSpan({
					cls: `sms-status sms-status-${auftritt.status}`,
					text: FUNNEL_TITEL[auftritt.status] ?? auftritt.status,
				});
				if (auftritt.bewertung !== undefined) {
					auftrittZeile.createSpan({
						cls: "sms-sterne",
						text: "★".repeat(auftritt.bewertung) + "☆".repeat(Math.max(0, 5 - auftritt.bewertung)),
					});
				}
			}
		}
	}
}
