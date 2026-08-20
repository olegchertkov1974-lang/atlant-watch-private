import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const outputDirectory = process.argv[2];
if (!outputDirectory) throw new Error("Expected the Netlify output directory.");

const indexPath = join(outputDirectory, "index.html");
let html = await readFile(indexPath, "utf8");

const assetPath = (url) => join(outputDirectory, url.replace(/^\//, ""));
const escapeScript = (code) => code.replace(/<\/script/gi, "<\\/script");

for (const match of [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/gi)]) {
  const css = await readFile(assetPath(match[1]), "utf8");
  html = html.replace(match[0], () => `<style data-inline-source="${match[1]}">${css}</style>`);
}

html = html.replace(/<link\b[^>]*\brel="preload"[^>]*\bas="script"[^>]*>/gi, "");

const runtimeShim = `<script data-inline-bootstrap>(function(){const e=Element.prototype;const g=e.getAttribute;e.getAttribute=function(n){if(String(n).toLowerCase()==="src"&&this instanceof HTMLScriptElement){const s=g.call(this,"data-inline-source");if(s)return new URL(s,location.href).href}return g.call(this,n)};const p=HTMLScriptElement.prototype;const d=Object.getOwnPropertyDescriptor(p,"src");if(!d||!d.get||!d.set)return;Object.defineProperty(p,"src",{configurable:d.configurable,enumerable:d.enumerable,get:function(){const s=g.call(this,"data-inline-source");return s?new URL(s,location.href).href:d.get.call(this)},set:function(v){d.set.call(this,v)}})})();</script>`;
html = html.replace(/<head([^>]*)>/i, (tag) => `${tag}${runtimeShim}`);

const embeddedScripts = new Set();
for (const match of [...html.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)><\/script>/gi)]) {
  const source = match[2];
  const code = escapeScript(await readFile(assetPath(source), "utf8"));
  const attributes = `${match[1]} ${match[3]}`
    .replace(/\sasync(?:="")?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  embeddedScripts.add(source.split("/").pop());
  html = html.replace(
    match[0],
    () => `<script${attributes ? ` ${attributes}` : ""} data-inline-source="${source}">${code}</script>`,
  );
}

const chunksDirectory = join(outputDirectory, "_next", "static", "chunks");
const remainingChunks = (await readdir(chunksDirectory))
  .filter((name) => name.endsWith(".js") && !embeddedScripts.has(name))
  .sort();

if (remainingChunks.length > 0) {
  const inlineChunks = await Promise.all(
    remainingChunks.map(async (name) => {
      const code = escapeScript(await readFile(join(chunksDirectory, name), "utf8"));
      return `<script data-inline-source="/_next/static/chunks/${name}">${code}</script>`;
    }),
  );
  html = html.replace("</body>", () => `${inlineChunks.join("")}\n</body>`);
}

await writeFile(indexPath, html);
console.log(`Inlined ${embeddedScripts.size + remainingChunks.length} scripts and styles into index.html.`);
