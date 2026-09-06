import type { StyleSpecification } from "@maplibre/maplibre-react-native";

import {
  boundaryLayers,
  graticuleLayers,
  labelLayers,
  landLayers,
  reliefLayers,
  waterLayers,
} from "./layers";
import { MAPTILER_HOST, createSources } from "./sources";
import { MAP_FEATURES } from "../../config/map";

export type OldAtlasStyleOptions = {
  apiKey: string;
  /** Sepia hillshading from terrain tiles. */
  relief?: boolean;
  /** Printed 15° latitude/longitude grid. */
  graticule?: boolean;
};

/**
 * Builds the MapLibre style: modern OpenStreetMap-derived geography, rendered
 * with the ink, washes and lettering of an engraved atlas plate.
 *
 * Layer order is the printing order — paper, washes, relief, water, grid,
 * borders, lettering — so anything added later should slot in by that logic.
 */
export function createOldAtlasStyle({
  apiKey,
  relief = MAP_FEATURES.relief,
  graticule = MAP_FEATURES.graticule,
}: OldAtlasStyleOptions): StyleSpecification {
  return {
    version: 8,
    name: "Old Atlas",
    glyphs: `${MAPTILER_HOST}/fonts/{fontstack}/{range}.pbf?key=${apiKey}`,
    sources: createSources({ apiKey, relief, graticule }),
    layers: [
      ...landLayers(),
      ...(relief ? reliefLayers() : []),
      ...waterLayers(),
      ...(graticule ? graticuleLayers() : []),
      ...boundaryLayers(),
      ...labelLayers(),
    ],
  };
}
