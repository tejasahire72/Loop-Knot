// Scans assets/<category>/ for photos and writes manifest.json for the site.
// Run locally with:  node scripts/build-manifest.mjs
// The GitHub Action runs it automatically on every push.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "assets");
const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw new Error(`Invalid JSON in ${path.relative(ROOT, file)}: ${e.message}`);
  }
}

// "01-sleepy_bunny.jpg" -> "Sleepy bunny"
function titleFromFile(file) {
  const t = file
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[-_ ]+/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const encodePath = (...parts) => parts.map(encodeURIComponent).join("/");

const site = await readJson(path.join(ROOT, "site.json"));
const dirs = (await readdir(ASSETS, { withFileTypes: true }))
  .filter(d => d.isDirectory() && !d.name.startsWith("."));

const categories = [];
for (const dir of dirs) {
  const folder = path.join(ASSETS, dir.name);
  const meta = await readJson(path.join(folder, "_category.json"));
  const details = await readJson(path.join(folder, "_items.json"));
  const files = (await readdir(folder))
    .filter(f => IMAGE.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  categories.push({
    id: dir.name,
    name: meta.name || titleFromFile(dir.name),
    blurb: meta.blurb || "",
    color: meta.color || "#FFE36E",
    order: Number.isFinite(meta.order) ? meta.order : 999,
    items: files.map(f => ({
      src: encodePath("assets", dir.name, f),
      title: details[f]?.title || titleFromFile(f),
      price: details[f]?.price || "",
      note: details[f]?.note || ""
    }))
  });
}
categories.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

const manifest = { generatedAt: new Date().toISOString(), site, categories };
await writeFile(path.join(ROOT, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`manifest.json written: ${categories.length} categories`);
for (const c of categories) console.log(`  ${c.name}: ${c.items.length} photo(s)`);
