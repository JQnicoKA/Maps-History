/**
 * Fabrique nos propres dossiers de glyphes à partir des polices d'`assets/fonts/src`.
 *
 * **Ce que MapLibre appelle une police n'est pas un fichier de police.** Il
 * dessine sur le GPU et n'a pas accès aux polices du système : pour tracer un
 * `R` il lui faut l'image du `R`, livrée en tranches de 256 points de code,
 * chacune un protobuf d'empreintes de distance signée. Les noms des
 * territoires viennent de Supabase ; ces fichiers-ci sont l'alphabet qui les
 * écrit.
 *
 * Pourquoi les héberger nous-mêmes alors que MapTiler les sert gratuitement :
 * ils passent par la **même clé** que le relief, qui est facturé. Le jour où
 * un plafond de dépense invalide cette clé, la carte perdrait tout son texte
 * en même temps que son ombrage — une ressource gratuite tuée par une
 * ressource payante. Ici, les étiquettes ne dépendent plus de rien.
 *
 * Et accessoirement : plus de serif chez MapTiler, donc plus de serif du tout.
 * Avec nos propres glyphes, le choix redevient libre.
 *
 * Sortie dans `build/glyphs/`, destinée au même R2 que l'archive PMTiles —
 * voir `docs/brancher-les-glyphes.md`. Rien n'entre dans le bundle : ce sont
 * des fichiers servis, pas des fichiers embarqués.
 *
 *     npm run glyphs
 */
import glyphComposite from "@mapbox/glyph-pbf-composite";
import fontnik from "fontnik";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FONT_STACKS } from "./glyph-stacks.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "assets/fonts/src");
const OUT_DIR = join(ROOT, "build/glyphs");

/** La taille d'une tranche, imposée par MapLibre : il les demande ainsi. */
const SLICE = 256;

/**
 * Le dernier point de code qu'un glyphe peut porter.
 *
 * Le protocole s'arrête au plan multilingue de base, et `fontnik` refuse une
 * tranche qui le dépasse. Noto Sans couvre quelques caractères au-delà — des
 * symboles mathématiques, pour l'essentiel —, et sans cette borne ils faisaient
 * échouer tout le script sur « option `end` must be a number from 0-65535 ».
 * MapLibre ne les demanderait de toute façon jamais.
 */
const LAST_POINT = 65535;

/** `fontnik.range` est à rappel ; tout le reste de ce script attend. */
const rangeOf = (font, start, end) =>
  new Promise((ok, non) =>
    fontnik.range({ font, start, end }, (err, buf) => (err ? non(err) : ok(buf))),
  );

const facesOf = (font) =>
  new Promise((ok, non) =>
    fontnik.load(font, (err, faces) => (err ? non(err) : ok(faces))),
  );

const files = readdirSync(SOURCE_DIR).filter((name) =>
  /\.(ttf|otf)$/i.test(name),
);

if (files.length === 0) {
  console.error(
    `Aucune police dans ${SOURCE_DIR}.\n` +
      "Déposez-y les .ttf, puis relancez. Voir docs/brancher-les-glyphes.md.",
  );
  process.exit(1);
}

/**
 * Les fontes chargées, rangées sous le nom que MapLibre emploie.
 *
 * Ce nom est `famille` + `style`, et c'est lui qui doit figurer dans
 * `typography.ts` — pas le nom du fichier. Un « SemiBold » qui se croyait
 * « Semi Bold » est le genre d'écart qui ne se voit qu'à l'exécution, en
 * étiquettes manquantes, d'où le relevé imprimé plus bas.
 */
const loaded = new Map();
for (const file of files.sort()) {
  const font = readFileSync(join(SOURCE_DIR, file));
  const [face] = await facesOf(font);
  const name = `${face.family_name} ${face.style_name}`;
  loaded.set(name, { font, points: face.points ?? [] });
  console.log(
    `${file.padEnd(34)} → ${name.padEnd(24)} ${String(face.points?.length ?? 0).padStart(6)} caractères`,
  );
}

const missing = FONT_STACKS.flat().filter((name) => !loaded.has(name));
if (missing.length > 0) {
  console.error(
    `\nIl manque ${[...new Set(missing)].map((n) => `« ${n} »`).join(", ")}.\n` +
      `Présentes : ${[...loaded.keys()].map((n) => `« ${n} »`).join(", ")}.\n` +
      "Les noms attendus sont ceux de `scripts/glyph-stacks.mjs`, eux-mêmes\n" +
      "ceux de `src/map/style/typography.ts`. Un nom qui ne correspond pas\n" +
      "donne une carte muette sur ce calque, sans aucune erreur.",
  );
  process.exit(1);
}

rmSync(OUT_DIR, { recursive: true, force: true });

let written = 0;
let weight = 0;

for (const stack of FONT_STACKS) {
  const name = stack.join(",");
  const dir = join(OUT_DIR, name);
  mkdirSync(dir, { recursive: true });

  /**
   * Seules les tranches qui contiennent quelque chose.
   *
   * Les fontes Noto couvrent le latin, le grec et le cyrillique, soit une
   * poignée de tranches sur les deux cent cinquante-six possibles. Écrire les
   * autres vides coûterait des milliers de fichiers pour rien ; une tranche
   * absente répond 404, ce que MapLibre encaisse sans rien perdre d'autre.
   */
  const slices = new Set();
  for (const face of stack) {
    for (const point of loaded.get(face).points) {
      if (point > LAST_POINT) continue;
      slices.add(Math.floor(point / SLICE));
    }
  }

  for (const slice of [...slices].sort((a, b) => a - b)) {
    const start = slice * SLICE;
    const end = start + SLICE - 1;

    // Une passe par fonte, puis composition dans l'ordre de la pile : la
    // première qui possède un caractère l'emporte, les suivantes bouchent.
    const parts = [];
    for (const face of stack) {
      parts.push(await rangeOf(loaded.get(face).font, start, end));
    }
    const pbf =
      parts.length === 1 ? parts[0] : glyphComposite.combine(parts, name);

    writeFileSync(join(dir, `${start}-${end}.pbf`), pbf);
    written += 1;
    weight += pbf.length;
  }

  console.log(`${name.padEnd(46)} ${String(slices.size).padStart(3)} tranches`);
}

console.log(
  `\n${written} fichiers, ${(weight / 1024 / 1024).toFixed(1)} Mo dans build/glyphs/.`,
);
console.log("À téléverser tel quel — voir docs/brancher-les-glyphes.md.");
