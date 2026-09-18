/**
 * Aged-atlas palette. Single source of truth for both the MapLibre style and
 * the surrounding UI, so map and chrome never drift apart.
 */
export const palette = {
  /** Land base — the parchment the map is printed on. */
  paper: "#E7D8B8",
  paperLight: "#F0E4CA",
  paperDeep: "#DDCBA5",

  /** Sepia printing ink, from heavy plate lines to faded engraving. */
  ink: "#4A3927",
  inkSoft: "#6E5940",
  inkFaint: "#8C7A5F",

  /** Hand-applied washes over the base colour. */
  forest: "#C9BC90",
  scrub: "#DCCFA3",
  sand: "#EDE0BC",
  ice: "#F4EFE2",
  wetland: "#C6C3A0",

  /** Hydrography. */
  ocean: "#A9C0C2",
  oceanDeep: "#8CA9AD",
  lake: "#B3C8C9",
  river: "#7F9DA1",
  waterInk: "#5C787D",

  /** Relief shading. */
  reliefHighlight: "#FBF3DF",
  reliefShadow: "#7A6242",

  /** Border wash printed under the plate line. */
  borderWash: "#B08A5E",

  /**
   * Flat washes for territories, in the manner of a hand-coloured plate.
   *
   * **Nine, and the count is not arbitrary.** The washes are handed out by map
   * colouring, so that no two polities that ever shared a border share a wash.
   * On this graph — the union of every date's map, and therefore not planar —
   * eight colours leave exactly one border uncoloured and nine leave none.
   * Adding or removing one means re-running `scripts/colour-polities.mjs`,
   * whose `COLOURS` must match this length.
   *
   * All nine sit near L 60 and C 19 so no polity shouts louder than another;
   * they are told apart by hue, and the periwinkle fills the one wide gap the
   * other eight left between slate and mauve.
   */
  washes: [
    "#B0885E", // terre cuite
    "#8FA07A", // vert-de-gris
    "#A8807E", // vieux rose
    "#7E9098", // bleu ardoise
    "#B39A63", // ocre
    "#94867F", // taupe
    "#7F8F6E", // olive
    "#A78A96", // mauve
    "#8E8EAE", // pervenche
  ],

  /** Hairlines and dividers: ink at a whisper, for modern chrome. */
  line: "#D8CBAE",
  /** Recessed surfaces — inputs, tracks, unselected segments. */
  sunken: "#E3D6B8",

  /**
   * Deletion, and nothing else.
   *
   * A true red rather than the wax: the wax means "here is what you are
   * reading", and the two must not be confused on a button that destroys
   * something. Still slightly warm, so it belongs to this paper.
   */
  danger: "#B3261E",

  /** Sealing wax — marks the event currently under the reader's eye. */
  wax: "#8C3A2B",
  waxDeep: "#6E2C21",
} as const;
