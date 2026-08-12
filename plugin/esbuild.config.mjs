import esbuild from "esbuild";
import process from "process";
import fs from "fs";
import builtins from "builtin-modules";

const production = process.argv[2] === "production";

// Die Version wird beim Bauen fest ins Bundle eingesetzt. Sie darf nicht zur
// Laufzeit aus dem Manifest kommen: Obsidian liest manifest.json beim Start und
// hält es danach fest, während main.js bei jedem Ein- und Ausschalten des
// Plugins neu ausgewertet wird. Die angezeigte Zahl soll sich genau dann
// ändern, wenn sich main.js ändert.
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  define: {
    __SMS_VERSION__: JSON.stringify(version),
  },
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: production,
});

if (production) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
