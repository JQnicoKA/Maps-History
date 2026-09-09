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
   * Flat washes for territories, in the manner of a hand-coloured plate. Muted
   * enough that the relief and landcover beneath still read through them.
   */
  washes: [
    "#B0885E",
    "#8FA07A",
    "#A8807E",
    "#7E9098",
    "#B39A63",
    "#94867F",
    "#7F8F6E",
    "#A78A96",
  ],

  /** Hairlines and dividers: ink at a whisper, for modern chrome. */
  line: "#D8CBAE",
  /** Recessed surfaces — inputs, tracks, unselected segments. */
  sunken: "#E3D6B8",

  /** Sealing wax — marks the event currently under the reader's eye. */
  wax: "#8C3A2B",
  waxDeep: "#6E2C21",
} as const;
