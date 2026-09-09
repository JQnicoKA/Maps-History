import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { LayerSpecification } from "@maplibre/maplibre-react-native";

import { SOURCE } from "../sources";
import { fonts } from "../typography";
import { palette } from "../../../theme/palette";

/** Latin transliteration when the tileset has one, native name otherwise. */
const name: ExpressionSpecification = [
  "coalesce",
  ["get", "name:latin"],
  ["get", "name"],
];

/** OpenMapTiles ranks are sparse; treat a missing rank as mid-importance. */
const rank: ExpressionSpecification = [
  "to-number",
  ["coalesce", ["get", "rank"], 4],
];

const halo = {
  "text-halo-color": palette.paperLight,
  "text-halo-width": 1.2,
  "text-halo-blur": 0.6,
} as const;

/**
 * Lettering follows atlas convention: land in tracked-out capitals, water in
 * italics, both weighted by the feature's rank rather than by zoom alone.
 *
 * Country and region names are deliberately absent: they would be today's, and
 * this map never shows two epochs at once. Political naming comes from the
 * historical territories instead — "Francia occidentalis", not "FRANCE".
 */
export function labelLayers(): LayerSpecification[] {
  return [
    {
      id: "label-ocean",
      type: "symbol",
      source: SOURCE.base,
      "source-layer": "water_name",
      maxzoom: 7,
      filter: ["match", ["get", "class"], ["ocean", "sea"], true, false],
      layout: {
        "text-field": name,
        "text-font": fonts.water,
        "text-transform": "uppercase",
        "text-letter-spacing": 0.5,
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, 11, 5, 16],
        "text-max-width": 7,
        "symbol-placement": "point",
      },
      paint: {
        "text-color": palette.waterInk,
        "text-halo-color": palette.ocean,
        "text-halo-width": 1,
        "text-opacity": 0.9,
      },
    },
    {
      id: "label-continent",
      type: "symbol",
      source: SOURCE.base,
      "source-layer": "place",
      maxzoom: 4,
      filter: ["==", ["get", "class"], "continent"],
      layout: {
        "text-field": name,
        "text-font": fonts.display,
        "text-transform": "uppercase",
        "text-letter-spacing": 0.42,
        "text-size": ["interpolate", ["linear"], ["zoom"], 0, 13, 3, 19],
        "text-max-width": 8,
      },
      paint: {
        ...halo,
        "text-color": palette.inkSoft,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 2.5, 0.85, 3.8, 0],
      },
    },
    {
      id: "label-lake",
      type: "symbol",
      source: SOURCE.base,
      "source-layer": "water_name",
      minzoom: 4,
      filter: ["match", ["get", "class"], ["ocean", "sea"], false, true],
      layout: {
        "text-field": name,
        "text-font": fonts.water,
        "text-letter-spacing": 0.1,
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 9, 10, 13],
        "text-max-width": 6,
        "symbol-placement": "point",
      },
      paint: {
        "text-color": palette.waterInk,
        "text-halo-color": palette.lake,
        "text-halo-width": 1,
      },
    },
    {
      id: "settlement-dot",
      type: "circle",
      source: SOURCE.base,
      "source-layer": "place",
      minzoom: 4,
      filter: ["match", ["get", "class"], ["city", "town"], true, false],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.6, 9, 3],
        "circle-color": palette.paperLight,
        "circle-stroke-color": palette.ink,
        "circle-stroke-width": 1,
        "circle-opacity": 1,
      },
    },
    {
      id: "label-settlement",
      type: "symbol",
      source: SOURCE.base,
      "source-layer": "place",
      minzoom: 4,
      filter: ["match", ["get", "class"], ["city", "town"], true, false],
      layout: {
        "text-field": name,
        "text-font": fonts.place,
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 9.5, 10, 13],
        "text-anchor": "left",
        "text-offset": [0.6, 0.1],
        "text-max-width": 7,
        "text-padding": 3,
        "symbol-sort-key": rank,
      },
      paint: { ...halo, "text-color": palette.ink },
    },
    {
      id: "label-peak",
      type: "symbol",
      source: SOURCE.base,
      "source-layer": "mountain_peak",
      minzoom: 7,
      layout: {
        "text-field": name,
        "text-font": fonts.water,
        "text-size": ["interpolate", ["linear"], ["zoom"], 7, 9, 11, 12],
        "text-max-width": 6,
        "symbol-sort-key": rank,
      },
      paint: { ...halo, "text-color": palette.inkSoft, "text-opacity": 0.9 },
    },
  ];
}
