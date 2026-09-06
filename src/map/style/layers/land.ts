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
