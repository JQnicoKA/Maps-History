/**
 * Rasterizes every drawn glyph in assets/icons/src into PNGs React Native can
 * display. These are interface icons — the trash can, the two view toggles.
 * Event types are drawn with their emoji, not with a glyph.
 *
 * React Native cannot render SVG without a native module, so the vectors are
 * the editable source and the PNGs are build output. Re-run after touching one:
 * `npm run icons`. The rasterizer is a devDependency — nothing here ships.
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "assets/icons/src");
const OUT_DIR = join(ROOT, "assets/icons");

/** Drawn at ~20pt, so 192px leaves ample margin on a 3x screen. */
const SIZE = 192;

mkdirSync(OUT_DIR, { recursive: true });

const sources = readdirSync(SOURCE_DIR).filter((file) => file.endsWith(".svg"));

for (const file of sources.sort()) {
  const svg = readFileSync(join(SOURCE_DIR, file));
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: SIZE },
    background: "rgba(0,0,0,0)",
  })
    .render()
    .asPng();

  const name = `${basename(file, ".svg")}.png`;
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`${name.padEnd(20)} ${String(png.length).padStart(6)} bytes`);
}

console.log(`\n${sources.length} icônes générées en ${SIZE}px.`);
