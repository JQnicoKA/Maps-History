import type { LayerSpecification } from "@maplibre/maplibre-react-native";

import { SOURCE } from "../sources";
import { palette } from "../../../theme/palette";

/**
 * Sepia hillshading in place of the hachures and copperplate shading of an
 * engraved atlas: warm highlights, brown shadows, no modern grey.
 */
export function reliefLayers(): LayerSpecification[] {
  return [
    {
      id: "relief",
      type: "hillshade",
      source: SOURCE.terrain,
      paint: {
        // Strong enough to read as engraved texture at world zoom, eased off as
        // the coastline and landcover detail take over.
        "hillshade-exaggeration": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.45,
          5,
          0.32,
          10,
          0.22,
        ],
        "hillshade-shadow-color": palette.reliefShadow,
        "hillshade-highlight-color": palette.reliefHighlight,
        "hillshade-accent-color": palette.inkSoft,
        "hillshade-illumination-direction": 315,
        "hillshade-illumination-anchor": "viewport",
      },
    },
  ];
}
