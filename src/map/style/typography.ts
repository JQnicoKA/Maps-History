/**
 * Font stacks, restricted to families MapTiler Cloud serves glyphs for
 * (Noto Sans, Metropolis, Open Sans, PT Sans, Roboto — no serif is available).
 *
 * The antique feel therefore comes from the *setting* rather than the typeface:
 * wide letter spacing and small caps for land, italics for water, exactly as
 * engraved atlas plates were lettered. Point `glyphs` at a self-hosted glyph
 * server in `createOldAtlasStyle` if you later want a true serif.
 */
export const fonts: Record<
  "display" | "country" | "place" | "water",
  string[]
> = {
  /** Continents and oceans: the widest-tracked lettering on the plate. */
  display: ["Metropolis Semi Bold", "Noto Sans Bold"],
  /** Country names. */
  country: ["Noto Sans Bold", "Noto Sans Regular"],
  /** Regions, settlements, peaks. */
  place: ["Noto Sans Regular"],
  /** Hydrography is always italic on an atlas plate. */
  water: ["Noto Sans Italic", "Noto Sans Regular"],
};
