/**
 * Die Version aus package.json, von esbuild beim Bauen fest eingesetzt.
 *
 * Bewusst nicht `plugin.manifest.version`: Obsidian liest manifest.json beim
 * Start und hält es danach fest, während main.js bei jedem Ein- und
 * Ausschalten des Plugins neu ausgewertet wird. Der Manifest-Wert kann damit
 * älter sein als der Code, den man gerade vor sich hat — und genau das soll
 * die Anzeige ja verraten.
 */
declare const __SMS_VERSION__: string;
