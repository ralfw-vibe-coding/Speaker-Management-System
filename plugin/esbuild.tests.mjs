import esbuild from "esbuild";
import { globSync } from "node:fs";

/**
 * Baut die Tests nach `tests/build/`, damit `node --test` sie ausführen kann.
 * esbuild ist ohnehin da; ein eigener Test-Läufer für TypeScript wäre eine
 * Abhängigkeit mehr für nichts.
 */
await esbuild.build({
	entryPoints: globSync("tests/*.test.ts"),
	outdir: "tests/build",
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node18",
	// Wie im Produktionsbuild: Markdown kommt als Text ins Bündel, sonst prüften
	// die Tests der Vault-Doku leere Strings.
	loader: { ".md": "text" },
	external: ["obsidian"],
	sourcemap: "inline",
	// .mjs, weil package.json kein "type": "module" hat und die Bündel ESM sind.
	outExtension: { ".js": ".mjs" },
	logLevel: "info",
});
