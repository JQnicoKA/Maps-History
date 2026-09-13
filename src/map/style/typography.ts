import { palette } from "../../theme/palette";

/**
 * The ring of paper printed around each letter, shared by every label on the
 * plate — territories, settlements, continents, peaks, water.
 *
 * Set to zero width: an engraved plate has no outline around its lettering,
 * and at any visible width the ring reads as a pale fringe rather than as
 * separation. What holds the names up instead is the ink's own contrast —
 * measured at worst 4.3:1 against the darkest wash, which is enough on a map.
 *
 * One number brings it back, the colour and the blur being already set. Around
 * 1.2 is where it was.
 */
export const HALO = {
  "text-halo-color": palette.paperLight,
  "text-halo-width": 0,
  "text-halo-blur": 0.6,
} as const;

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
