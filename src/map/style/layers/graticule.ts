import type { LayerSpecification } from "@maplibre/maplibre-react-native";

import { SOURCE } from "../sources";
import { palette } from "../../../theme/palette";

/**
 * The printed 15° grid. Present at plate scale, faded out once the view is
 * regional and the grid would only be one stray line across the screen.
 */
export function graticuleLayers(): LayerSpecification[] {
  return [
    {
      id: "graticule",
      type: "line",
      source: SOURCE.graticule,
      paint: {
        "line-color": palette.inkFaint,
        "line-width": 0.5,
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.3,
          5,
          0.16,
          8,
          0,
        ],
      },
    },
  ];
}
