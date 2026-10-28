import { describe, expect, it } from "vitest";

import { fonts } from "./typography";
// Table partagée en JS, lue aussi par `scripts/generate-glyphs.mjs`.
import { FONT_STACKS } from "../../../scripts/glyph-stacks.mjs";

/**
 * Le garde-fou de l'auto-hébergement des glyphes.
 *
 * Les dossiers de glyphes sont fabriqués hors de l'application, par
 * `npm run glyphs`, d'après `scripts/glyph-stacks.mjs`. Si quelqu'un ajoute
 * une pile dans `typography.ts` sans la déclarer là-bas, rien ne casse à la
 * compilation : la carte perd simplement **tout le texte de ce calque**, en
 * silence, le jour du déploiement — MapLibre demande un dossier qui n'existe
 * pas et reçoit un 404.
 *
 * C'est exactement le genre de panne que `variants.test.ts` garde pour les
 * schémas d'URL, et pour la même raison : deux listes que personne ne compare
 * finissent par diverger.
 */
describe("les piles de glyphes", () => {
  const asked = [...new Set(Object.values(fonts).map((pile) => pile.join(",")))];
  const built = (FONT_STACKS as string[][]).map((pile) => pile.join(","));

  it("couvre chaque pile que le style demande", () => {
    for (const pile of asked) expect(built).toContain(pile);
  });

  it("n'en fabrique aucune que le style ne demande pas", () => {
    for (const pile of built) expect(asked).toContain(pile);
  });
});
