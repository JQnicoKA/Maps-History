import type { LayerSpecification } from "@maplibre/maplibre-react-native";

import { SOURCE } from "../sources";
import { palette } from "../../../theme/palette";

/**
 * The parchment itself plus the hand-applied colour washes over it. Fills stay
 * translucent so the paper tone reads through every landcover class.
 */
export function landLayers(): LayerSpecification[] {
  return [
    {
      id: "paper",
      type: "background",
      paint: { "background-color": palette.paper },
    },
    {
      /**
       * The washes at world and continental scale.
       *
       * A second landcover layer, and not a duplicate: OpenMapTiles splits the
       * subject in two and the halves do not overlap in practice. `landcover`
       * is traced from OSM and only becomes populated past z9 — measured on a
       * real tile, at z5 it holds one kilobyte and nothing but glaciers, which
       * is why the continents read as bare parchment at every scale a reader
       * actually browses. `globallandcover` is the raster-derived twin that
       * covers z0–9, and it was already arriving in every tile — a hundred
       * kilobytes of it, discarded unread.
       *
       * So this costs nothing that was not already paid for. It simply prints
       * what was in the parcel.
       */
      id: "globallandcover-wash",
      type: "fill",
      source: SOURCE.base,
      "source-layer": "globallandcover",
      // Where the traced layer takes over. Beyond this the source has no data
      // at all, so drawing it would only cost a lookup.
      maxzoom: 9,
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          // Its vocabulary is its own — read off a tile rather than guessed:
          // crop, forest, grass, scrub, snow, tree.
          "forest",
          palette.forest,
          "tree",
          palette.forest,
          "scrub",
          palette.scrub,
          "grass",
          palette.scrub,
          "crop",
          palette.sand,
          "snow",
          palette.ice,
          palette.paperDeep,
        ],
        // Lighter than the traced washes above. At world scale the eye takes
        // in whole continents at once, and a tint that reads as "a wash over
        // paper" close up reads as "a coloured map" from far: the parchment
        // has to stay the thing one sees first.
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.22,
          4,
          0.3,
          9,
          0.4,
        ],
        "fill-antialias": false,
      },
    },
    {
      id: "landcover-wash",
      type: "fill",
      source: SOURCE.base,
      "source-layer": "landcover",
      filter: ["!=", ["get", "class"], "ice"],
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "wood",
          palette.forest,
          "grass",
          palette.scrub,
          "farmland",
          palette.scrub,
          "sand",
          palette.sand,
          "wetland",
          palette.wetland,
          palette.paperDeep,
        ],
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.3,
          4,
          0.45,
          8,
          0.5,
        ],
        // Washes abut each other; antialiasing their shared edges only produces
        // seams, and turning it off is measurably cheaper at world zoom.
        "fill-antialias": false,
      },
    },
    {
      id: "landcover-ice",
      type: "fill",
      source: SOURCE.base,
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "ice"],
      paint: {
        "fill-color": palette.ice,
        "fill-opacity": 0.85,
        "fill-antialias": false,
      },
    },
  ];
}
