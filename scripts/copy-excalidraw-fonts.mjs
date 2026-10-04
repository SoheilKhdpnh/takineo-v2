// Copies Excalidraw's bundled fonts into public/ so the whiteboard does not load
// them from a public CDN. Skips the large CJK Xiaolai font; Excalidraw falls back
// to its CDN for that one. Output is generated and gitignored.
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@excalidraw", "excalidraw", "dist", "prod", "fonts");
const target = join(root, "public", "excalidraw-assets", "fonts");
const SKIPPED_FAMILIES = new Set(["Xiaolai"]);

if (!existsSync(source)) {
  console.warn(`copy-excalidraw-fonts: ${source} not found; skipping.`);
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

const families = (await readdir(source, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !SKIPPED_FAMILIES.has(entry.name))
  .map((entry) => entry.name);

for (const family of families) {
  await cp(join(source, family), join(target, family), { recursive: true });
}

console.log(`copy-excalidraw-fonts: copied ${families.length} font families.`);
