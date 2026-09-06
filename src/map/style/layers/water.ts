import type { LayerSpecification } from "@maplibre/maplibre-react-native";

import { SOURCE } from "../sources";
import { palette } from "../../../theme/palette";

/**
 * Seas, lakes and rivers. The blurred band inside every shoreline reproduces
 * the concentric coastal shading engravers drew around landmasses.
 */
export function waterLayers(): LayerSpecification[] {
  return [
    {
      id: "water",
      type: "fill",
      source: SOURCE.base,
      "source-layer": "water",
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "ocean",
          palette.ocean,
          palette.lake,
        ],
      },
    },
    {
      id: "water-coast-shade",
      type: "line",
      source: SOURCE.base,
      "source-layer": "water",
      paint: {
        "line-color": palette.oceanDeep,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 3, 6, 10, 10, 18],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 0, 3, 6, 8, 10, 14],
        "line-opacity": 0.55,
      },
    },
    {
      id: "coastline",
      type: "line",
      source: SOURCE.base,
      "source-layer": "water",
      paint: {
        "line-color": palette.waterInk,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 6, 0.9, 10, 1.3],
        "line-opacity": 0.75,
      },
    },
    {
      id: "waterway",
      type: "line",
      source: SOURCE.base,
      "source-layer": "waterway",
      minzoom: 4,
      filter: ["match", ["get", "class"], ["river", "canal"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.river,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 8, 0.9, 11, 1.6],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.35, 7, 0.7],
      },
    },
  ];
}
