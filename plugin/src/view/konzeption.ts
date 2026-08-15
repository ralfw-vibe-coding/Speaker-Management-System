import { Notice, type App, type TFile } from "obsidian";
import type { Datenzugriff } from "../daten/lesen";
import type { Datenschreiber } from "../daten/schreiben";
import { entwurfsbild } from "../daten/projektion";
import { BestaetigenModal, TextModal } from "./rasterModale";
import {
	FORMAT_TITEL,
	ZUGESAGT_UND_WEITER,
	type Beitrag,
	type Engagement,
	type Block,
	type Konferenz,
	type Strang,
} from "../daten/modell";

/** Die Spalte, in der eine Karte liegt: ein Strang, der Eingang oder der Ausgang. */
type Spalte = { art: "ohne" } | { art: "strang"; id: string } | { art: "verworfen" };

/**
 * Die Konzeption: die Konferenz als Idee, bevor es ein Raster gibt.
 *
 * Eine Pinnwand, deren Spalten **Stränge** sind — Themenlinien, die sich beim
 * Nachdenken herausbilden. Was hier fehlt, fehlt mit Absicht: keine Uhrzeiten,
 * keine Räume, keine Parallelität. Wer in dieser Phase schon Blöcke schiebt,
 * plant, statt zu denken.
 *
 * Die Karten sind dieselben Beitragsnotizen, die später im Raster stehen. Eine
 * Idee ist ein Beitrag ohne Block; der Strang steht in einem eigenen Feld und
 * bleibt stehen, wenn später ein Track dazukommt. Deshalb ist der Übergang zur
 * echten Konferenz kein Umwandeln, sondern ein Platzieren.
 */
export class Konzeption {
	private konferenz: Konferenz | undefined;
	private buehne: HTMLElement | undefined;
	private gezogen: Beitrag | null = null;

	constructor(
		private app: App,
		private daten: Datenzugriff,
		private schreiber: Datenschreiber,
		private notizOeffnen: (datei: TFile) => void,
	) {}

	async zeichnen(buehne: HTMLElement, konferenz: Konferenz | undefined): Promise<void> {
		buehne.empty();
		buehne.addClass("sms-konzeption");
		this.buehne = buehne;
		this.konferenz = konferenz;

		if (!konferenz) {
			buehne.createEl("p", {
				cls: "sms-leer",
				text: "Keine Konferenz gefunden. Stimmt der Konferenzordner in den Einstellungen?",
			});
			return;
		}

		const beitraege = this.daten
			.beitraege()
			.filter((beitrag) => beitrag.konferenz === konferenz.name);
		const engagements = new Map(
			this.daten
				.engagements()
				.filter((engagement) => engagement.konferenz === konferenz.name)
				.map((engagement) => [engagement.speaker, engagement]),
		);

		this.kopfZeichnen(buehne, konferenz, beitraege);

		const spalten = buehne.createDiv({ cls: "sms-straenge" });

		// Der Eingang zuerst: Denken fängt nicht sortiert an.
		this.spalteZeichnen(
			spalten,
			{ art: "ohne" },
			"ohne Strang",
			beitraege.filter((beitrag) => !beitrag.verworfenAm && !beitrag.strang),
			engagements,
		);

		for (const strang of konferenz.straenge) {
			this.spalteZeichnen(
				spalten,
				{ art: "strang", id: strang.id },
				strang.name,
				beitraege.filter((beitrag) => !beitrag.verworfenAm && beitrag.strang === strang.id),
				engagements,
				strang,
			);
		}

		// Der Ausgang zuletzt: aufgehoben, nicht gelöscht.
		this.spalteZeichnen(
			spalten,
			{ art: "verworfen" },
			"verworfen",
			beitraege.filter((beitrag) => !!beitrag.verworfenAm),
			engagements,
		);

		this.fussZeichnen(buehne, konferenz, beitraege);
	}

	// -------------------------------------------------------------- Zeichnen

	private kopfZeichnen(buehne: HTMLElement, konferenz: Konferenz, beitraege: Beitrag[]): void {
		const bild = entwurfsbild(beitraege);
		const kopf = buehne.createDiv({ cls: "sms-tafel-kopf" });

		const links = kopf.createDiv();
		links.createDiv({ cls: "sms-konferenz", text: konferenz.name });

		const untertitel = [konferenz.untertitel, konferenz.veranstalter].filter(
			(teil): teil is string => !!teil,
		);
		if (untertitel.length > 0) {
			links.createDiv({ cls: "sms-konferenz-zeile", text: untertitel.join(" · ") });
		}

		const marken = kopf.createDiv({ cls: "sms-marken" });
		marken.createSpan({ cls: "sms-marke", text: `${bild.ideen} Ideen` });
		marken.createSpan({ cls: "sms-marke", text: `${konferenz.straenge.length} Stränge` });
		if (bild.ohneStrang > 0) {
			marken.createSpan({ cls: "sms-marke", text: `${bild.ohneStrang} ohne Strang` });
		}
		if (bild.verworfen > 0) {
			marken.createSpan({ cls: "sms-marke", text: `${bild.verworfen} verworfen` });
		}
	}

	private spalteZeichnen(
		eltern: HTMLElement,
		spalte: Spalte,
		titel: string,
		karten: Beitrag[],
		engagements: Map<string, Engagement>,
		strang?: Strang,
	): void {
		const kasten = eltern.createDiv({ cls: `sms-strang is-${spalte.art}` });

		const kopf = kasten.createDiv({ cls: "sms-spalte-kopf" });
		kopf.createSpan({ cls: "sms-spalte-titel", text: titel });
		kopf.createSpan({ cls: "sms-spalte-zahl", text: karten.length > 0 ? String(karten.length) : "" });

		if (strang) {
			this.werkzeug(kopf, "✎", () => void this.strangAendern(strang));
			this.werkzeug(kopf, "✕", () => void this.strangLoeschen(strang));
		}

		kasten.addEventListener("dragover", (ereignis) => {
			if (!this.gezogen) return;
			ereignis.preventDefault();
			kasten.addClass("is-ziel");
		});
		kasten.addEventListener("dragleave", (ereignis) => {
			if (kasten.contains(ereignis.relatedTarget as Node)) return;
			kasten.removeClass("is-ziel");
		});
		kasten.addEventListener("drop", (ereignis) => {
			if (!this.gezogen) return;
			ereignis.preventDefault();
			kasten.removeClass("is-ziel");
			void this.ablegen(this.gezogen, spalte);
		});

		for (const karte of karten) this.karteZeichnen(kasten, karte, spalte, engagements);

		if (spalte.art !== "verworfen") {
			const neu = kasten.createEl("button", { cls: "sms-idee-neu", text: "＋ Idee" });
			neu.addEventListener("click", () => {
				void this.ideeAnlegen(spalte.art === "strang" ? spalte.id : undefined);
			});
		}
	}

	private karteZeichnen(
		eltern: HTMLElement,
		beitrag: Beitrag,
		spalte: Spalte,
		engagements: Map<string, Engagement>,
	): void {
		const karte = eltern.createDiv({ cls: "sms-idee" });
		karte.addEventListener("click", () => this.notizOeffnen(beitrag.datei));

		karte.draggable = true;
		karte.addEventListener("dragstart", (ereignis) => {
			this.gezogen = beitrag;
			karte.addClass("is-zieht");
			ereignis.dataTransfer?.setData("text/plain", beitrag.datei.path);
			if (ereignis.dataTransfer) ereignis.dataTransfer.effectAllowed = "move";
		});
		karte.addEventListener("dragend", () => {
			karte.removeClass("is-zieht");
			this.gezogen = null;
			this.buehne?.findAll(".is-ziel").forEach((el) => el.removeClass("is-ziel"));
		});

		karte.createDiv({
			cls: beitrag.titel ? "sms-idee-titel" : "sms-idee-titel is-offen",
			text: beitrag.titel || "noch ohne Titel",
		});

		// Der Name ist hier ein Einfall, keine Zusage — ein Klick ändert ihn.
		const wer = karte.createDiv({ cls: "sms-idee-wer" });
		const name = beitrag.speaker[0];
		wer.createSpan({
			cls: name ? "sms-idee-name" : "sms-idee-name is-offen",
			text: name ?? "wer?",
		});
		wer.addEventListener("click", (ereignis) => {
			ereignis.stopPropagation();
			void this.speakerAendern(beitrag);
		});

		const chips = karte.createDiv({ cls: "sms-idee-chips" });
		if (beitrag.format) {
			chips.createSpan({
				cls: "sms-chip-format",
				text: FORMAT_TITEL[beitrag.format] ?? beitrag.format,
			});
		}
		if (beitrag.dauer) chips.createSpan({ cls: "sms-chip-dauer", text: `${beitrag.dauer} Min` });

		// Steht schon eine Zusage dahinter, ist es keine Idee mehr, sondern Programm.
		const engagement = name ? engagements.get(name) : undefined;
		if (engagement && ZUGESAGT_UND_WEITER.includes(engagement.status)) {
			chips.createSpan({ cls: "sms-chip-zugesagt", text: "zugesagt" });
		}
		if (beitrag.bloecke.length > 0) {
			chips.createSpan({ cls: "sms-chip-eingeplant", text: "eingeplant" });
		}

		if (spalte.art === "verworfen") {
			this.werkzeug(karte, "↩ zurückholen", () => void this.verwerfen(beitrag, false));
		} else {
			this.werkzeug(karte, "✕", () => void this.verwerfen(beitrag, true), "verwerfen");
		}
	}

	/**
	 * Die Rechnung, um die es in dieser Phase geht: welches Raster die Ideen
	 * bräuchten. Die Stränge laufen parallel, also bestimmt der längste die Zahl
	 * der Blöcke — das ist die Angabe, mit der man zum Veranstalter geht.
	 */
	private fussZeichnen(buehne: HTMLElement, konferenz: Konferenz, beitraege: Beitrag[]): void {
		const bild = entwurfsbild(beitraege);
		if (konferenz.straenge.length === 0 && bild.ideen === 0) return;

		const fuss = buehne.createDiv({ cls: "sms-konzeption-fuss" });

		const text = fuss.createDiv({ cls: "sms-konzeption-rechnung" });
		if (bild.bloecke === 0) {
			text.createSpan({
				text: "Noch keine Idee hängt an einem Strang — daraus lässt sich kein Raster rechnen.",
			});
		} else {
			text.createSpan({
				text:
					`${bild.ideen} Ideen auf ${konferenz.straenge.length} Stränge: ` +
					`Das ergibt ${bild.bloecke} Blöcke, wenn alle parallel laufen.`,
			});
			if (bild.ohneStrang > 0) {
				text.createSpan({
					cls: "sms-konzeption-nachsatz",
					text: ` ${bild.ohneStrang} ohne Strang sind dabei nicht mitgerechnet.`,
				});
			}
		}

		fuss.createEl("button", { cls: "sms-werkzeug", text: "＋ Strang" }).addEventListener(
			"click",
			() => void this.strangAnlegen(),
		);

		if (bild.bloecke === 0) return;
		const knopf = fuss.createEl("button", { cls: "sms-anlegen mod-cta", text: "Raster daraus bauen" });
		knopf.addEventListener("click", () => void this.rasterBauen(konferenz, beitraege));
	}

	/**
	 * Der eine Vorgang, der die Konzeption in eine Konferenz überführt: Aus
	 * Strängen werden Tracks, dazu entsteht ein Tag mit so vielen Blöcken, wie
	 * der längste Strang braucht.
	 *
	 * Die Ideen bekommen dabei ihren **Track**, aber keinen Block — sie landen im
	 * Pool der Agenda und werden von dort einzeln platziert. Automatisch zu
	 * verteilen wäre geraten: Welche Keynote in den ersten Block gehört, weiß nur
	 * der Mensch. Der `strang` bleibt stehen, damit der Entwurf nachlesbar ist.
	 */
	private async rasterBauen(konferenz: Konferenz, beitraege: Beitrag[]): Promise<void> {
		const bild = entwurfsbild(beitraege);
		const takt = 45;

		// Nur Stränge, die etwas enthalten — ein leerer Strang ist kein Track.
		const gefuellt = konferenz.straenge.filter((strang) => (bild.proStrang.get(strang.id) ?? 0) > 0);
		if (gefuellt.length === 0) return;

		const vorhandene = new Set(konferenz.tracks.map((track) => track.id));
		const neueTracks = gefuellt
			.filter((strang) => !vorhandene.has(strang.id))
			.map((strang) => ({ id: strang.id, name: strang.name }));

		const bloecke: Block[] = [];
		let zeit = 9 * 60;
		for (let i = 0; i < bild.bloecke; i += 1) {
			bloecke.push({
				id: this.freieBlockId(konferenz, bloecke),
				von: alsZeit(zeit),
				bis: alsZeit(zeit + takt),
				nur: [],
			});
			// Fünfzehn Minuten dazwischen — Umbauzeit, die man später verschiebt.
			zeit += takt + 15;
		}

		const frage =
			`Aus ${gefuellt.length} ${gefuellt.length === 1 ? "Strang wird ein Track" : "Strängen werden Tracks"}` +
			`, dazu entsteht ein Tag mit ${bloecke.length} Blöcken à ${takt} Minuten ab 09:00.\n\n` +
			`Die ${bild.ideen - bild.ohneStrang} Ideen mit Strang bekommen ihren Track und liegen ` +
			`danach im Pool der Agenda — platziert werden sie dort von Hand.` +
			(bild.ohneStrang > 0 ? `\n\n${bild.ohneStrang} ohne Strang bleiben, wo sie sind.` : "") +
			(konferenz.tage.length > 0 ? "\n\nDie bestehenden Tage bleiben unangetastet; der neue kommt dazu." : "");

		const ja = await new BestaetigenModal(this.app, "Raster bauen", frage, "Bauen").frage();
		if (!ja) return;

		try {
			await this.schreiber.rasterSchreiben(
				konferenz,
				[...konferenz.tracks, ...neueTracks],
				[...konferenz.tage, { tracks: gefuellt.map((strang) => strang.id), bloecke }],
			);

			for (const beitrag of beitraege) {
				if (!beitrag.strang || beitrag.verworfenAm || beitrag.track) continue;
				if (!gefuellt.some((strang) => strang.id === beitrag.strang)) continue;
				await this.schreiber.beitraegePlatzieren([
					{ datei: beitrag.datei, bloecke: beitrag.bloecke, track: beitrag.strang },
				]);
			}

			new Notice("Das Raster steht. Die Ideen liegen im Pool der Agenda.");
		} catch (fehler) {
			new Notice(`Das Raster ließ sich nicht bauen: ${String(fehler)}`);
		}
	}

	/** Eine Block-Id, die es konferenzweit noch nicht gibt. */
	private freieBlockId(konferenz: Konferenz, neue: Block[]): string {
		const vergeben = new Set([
			...konferenz.tage.flatMap((tag) => tag.bloecke.map((block) => block.id)),
			...neue.map((block) => block.id),
		]);
		let nummer = vergeben.size + 1;
		while (vergeben.has(`b${nummer}`)) nummer += 1;
		return `b${nummer}`;
	}

	private werkzeug(eltern: HTMLElement, text: string, tun: () => void, titel?: string): void {
		const knopf = eltern.createEl("button", {
			cls: "sms-werkzeug",
			text,
			attr: titel ? { title: titel } : {},
		});
		knopf.addEventListener("click", (ereignis) => {
			ereignis.stopPropagation();
			tun();
		});
	}

	// ------------------------------------------------------------- Schreiben

	private async ablegen(beitrag: Beitrag, ziel: Spalte): Promise<void> {
		try {
			if (ziel.art === "verworfen") {
				await this.schreiber.verwerfen(beitrag.datei, true);
				return;
			}
			// Aus dem Ausgang zurück: Das Verwerfen wird zurückgenommen und der
			// Strang gleich mitgesetzt.
			if (beitrag.verworfenAm) await this.schreiber.verwerfen(beitrag.datei, false);
			await this.schreiber.strangSetzen(
				beitrag.datei,
				ziel.art === "strang" ? ziel.id : undefined,
			);
		} catch (fehler) {
			new Notice(`Das ließ sich nicht schreiben: ${String(fehler)}`);
		}
	}

	private async verwerfen(beitrag: Beitrag, verworfen: boolean): Promise<void> {
		try {
			await this.schreiber.verwerfen(beitrag.datei, verworfen);
		} catch (fehler) {
			new Notice(`Das ließ sich nicht schreiben: ${String(fehler)}`);
		}
	}

	private async ideeAnlegen(strang?: string): Promise<void> {
		const konferenz = this.konferenz;
		if (!konferenz) return;

		const titel = await new TextModal(this.app, {
			titel: "Neue Idee",
			beschriftung: "Worum soll es gehen?",
			hinweis: "Ein Arbeitstitel genügt — ändern kannst du ihn jederzeit in der Notiz.",
			knopf: "Anlegen",
		}).frage();
		if (!titel) return;

		try {
			await this.schreiber.ideeAnlegen(konferenz, titel, strang);
		} catch (fehler) {
			new Notice(`Die Idee ließ sich nicht anlegen: ${String(fehler)}`);
		}
	}

	private async speakerAendern(beitrag: Beitrag): Promise<void> {
		const name = await new TextModal(this.app, {
			titel: "Wer könnte das machen?",
			beschriftung: "Name",
			hinweis:
				"Ein Einfall, keine Zusage. Leer lassen nimmt den Namen wieder heraus. " +
				"Ob daraus ein Engagement wird, entscheidet die Statustafel.",
			vorgabe: beitrag.speaker[0] ?? "",
			vorschlaege: this.daten.speakerNamen(),
			knopf: "Übernehmen",
			leerErlaubt: true,
		}).frage();
		if (name === undefined) return;

		try {
			await this.schreiber.speakerZuweisen(beitrag.datei, name.trim());
		} catch (fehler) {
			new Notice(`Der Name ließ sich nicht schreiben: ${String(fehler)}`);
		}
	}

	private async strangAnlegen(): Promise<void> {
		const konferenz = this.konferenz;
		if (!konferenz) return;

		const name = await new TextModal(this.app, {
			titel: "Neuer Strang",
			beschriftung: "Wie heißt die Themenlinie?",
			hinweis: "Ein Strang ist noch kein Track — er darf entstehen und wieder vergehen.",
			knopf: "Anlegen",
		}).frage();
		if (!name) return;

		try {
			const id = this.freieId(konferenz.straenge, name);
			await this.schreiber.straengeSchreiben(konferenz, [
				...konferenz.straenge,
				{ id, name: name.trim() },
			]);
		} catch (fehler) {
			new Notice(`Der Strang ließ sich nicht anlegen: ${String(fehler)}`);
		}
	}

	private async strangAendern(strang: Strang): Promise<void> {
		const konferenz = this.konferenz;
		if (!konferenz) return;

		const name = await new TextModal(this.app, {
			titel: "Strang umbenennen",
			beschriftung: "Name",
			vorgabe: strang.name,
			knopf: "Übernehmen",
		}).frage();
		if (!name) return;

		try {
			// Die Id bleibt: An ihr hängen die Ideen.
			await this.schreiber.straengeSchreiben(
				konferenz,
				konferenz.straenge.map((eigener) =>
					eigener.id === strang.id ? { ...eigener, name: name.trim() } : eigener,
				),
			);
		} catch (fehler) {
			new Notice(`Der Name ließ sich nicht schreiben: ${String(fehler)}`);
		}
	}

	private async strangLoeschen(strang: Strang): Promise<void> {
		const konferenz = this.konferenz;
		if (!konferenz) return;

		const betroffene = this.daten
			.beitraege()
			.filter(
				(beitrag) =>
					beitrag.konferenz === konferenz.name &&
					beitrag.strang === strang.id &&
					!beitrag.verworfenAm,
			);

		const frage =
			betroffene.length === 0
				? `„${strang.name}" auflösen?`
				: `„${strang.name}" auflösen? ${betroffene.length} ${
						betroffene.length === 1 ? "Idee wandert" : "Ideen wandern"
					} zurück nach „ohne Strang" — verworfen wird nichts.`;

		const ja = await new BestaetigenModal(this.app, "Strang auflösen", frage, "Auflösen").frage();
		if (!ja) return;

		try {
			for (const beitrag of betroffene) {
				await this.schreiber.strangSetzen(beitrag.datei, undefined);
			}
			await this.schreiber.straengeSchreiben(
				konferenz,
				konferenz.straenge.filter((eigener) => eigener.id !== strang.id),
			);
		} catch (fehler) {
			new Notice(`Der Strang ließ sich nicht auflösen: ${String(fehler)}`);
		}
	}

	/** Eine Id, die es noch nicht gibt — aus dem Namen, sonst durchnummeriert. */
	private freieId(vorhandene: Strang[], name: string): string {
		const vergeben = new Set(vorhandene.map((strang) => strang.id));
		const aus = name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9äöüß]+/g, "-")
			.replace(/^-|-$/g, "");
		if (aus.length > 0 && !vergeben.has(aus)) return aus;

		let nummer = vorhandene.length + 1;
		while (vergeben.has(`s${nummer}`)) nummer += 1;
		return `s${nummer}`;
	}
}

/** Minuten seit Mitternacht als `09:45`. */
function alsZeit(minuten: number): string {
	const stunde = Math.floor(minuten / 60) % 24;
	const rest = minuten % 60;
	return `${String(stunde).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
