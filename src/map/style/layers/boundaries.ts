import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { LayerSpecification } from "@maplibre/maplibre-react-native";

import { SOURCE } from "../sources";
import { palette } from "../../../theme/palette";

/** Maritime boundaries are a modern cartographic convention — never drawn. */
const onLand: ExpressionSpecification = ["!=", ["get", "maritime"], 1];

const country: ExpressionSpecification = ["==", ["get", "admin_level"], 2];

/**
 * Present-day borders, drawn the way they were printed: a soft colour wash
 * brushed along the frontier with a fine plate line inked over it.
 */
export function boundaryLayers(): LayerSpecification[] {
  return [
    {
      id: "boundary-country-wash",
      type: "line",
      source: SOURCE.base,
      "source-layer": "boundary",
      filter: ["all", country, onLand],
      layout: { "line-join": "round" },
      paint: {
        "line-color": palette.borderWash,
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 2.5, 5, 7, 10, 14],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 1, 2, 5, 5, 10, 9],
        "line-opacity": 0.32,
      },
    },
    {
      id: "boundary-state",
      type: "line",
      source: SOURCE.base,
      "source-layer": "boundary",
      minzoom: 4,
      filter: ["all", ["==", ["get", "admin_level"], 4], onLand],
      paint: {
        "line-color": palette.inkFaint,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 10, 0.9],
        "line-dasharray": [3, 2],
        "line-opacity": 0.5,
      },
    },
    {
      id: "boundary-country",
      type: "line",
      source: SOURCE.base,
      "source-layer": "boundary",
      filter: ["all", country, onLand, ["!=", ["get", "disputed"], 1]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": palette.ink,
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 5, 1.1, 10, 1.7],
        "line-opacity": 0.85,
      },
    },
    {
      id: "boundary-country-disputed",
      type: "line",
      source: SOURCE.base,
      "source-layer": "boundary",
      filter: ["all", country, onLand, ["==", ["get", "disputed"], 1]],
      paint: {
        "line-color": palette.ink,
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 5, 1.1, 10, 1.7],
        "line-dasharray": [2, 2],
        "line-opacity": 0.7,
      },
    },
  ];
}
