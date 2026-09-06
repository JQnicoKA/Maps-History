import type { SourceSpecification } from "@maplibre/maplibre-react-native";

import { createGraticule } from "./graticule";
import { ATTRIBUTION, TILE_MAX_ZOOM } from "../../config/map";

export const MAPTILER_HOST = "https://api.maptiler.com";

/** Source names, referenced by every layer definition. */
export const SOURCE = {
  /** MapTiler's planet tileset, OpenMapTiles schema. */
  base: "openmaptiles",
  /** Terrain-RGB elevation tiles, consumed by the hillshade layer. */
  terrain: "terrain",
  graticule: "graticule",
} as const;

export type SourceOptions = {
  apiKey: string;
  relief: boolean;
  graticule: boolean;
};

export function createSources({
  apiKey,
  relief,
  graticule,
}: SourceOptions): Record<string, SourceSpecification> {
  const sources: Record<string, SourceSpecification> = {
    [SOURCE.base]: {
      type: "vector",
      // Declared explicitly rather than through tiles.json so `maxzoom` can be
      // capped below the tileset's own z14: everything past z10 is street and
      // building data this style never draws.
      tiles: [`${MAPTILER_HOST}/tiles/v3/{z}/{x}/{y}.pbf?key=${apiKey}`],
      minzoom: 0,
      maxzoom: TILE_MAX_ZOOM,
      attribution: ATTRIBUTION,
    },
  };

  if (relief) {
    sources[SOURCE.terrain] = {
      type: "raster-dem",
      url: `${MAPTILER_HOST}/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`,
    };
  }

  if (graticule) {
    sources[SOURCE.graticule] = {
      type: "geojson",
      data: createGraticule(),
    };
  }

  return sources;
}
