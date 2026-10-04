import type { SourceSpecification } from "@maplibre/maplibre-react-native";

import { createGraticule } from "./graticule";
import { ATTRIBUTION, RELIEF_MAX_ZOOM, TILE_MAX_ZOOM } from "../../config/map";

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
  /**
   * Notre propre archive PMTiles, ou la chaîne vide.
   *
   * Un seul interrupteur pour tout le fond de carte : renseigné, plus une
   * requête de fond ne part chez MapTiler ; vidé, on y retourne sans rien
   * recompiler d'autre que le bundle. Voir `docs/brancher-les-tuiles.md`.
   */
  tilesUrl: string;
};

export function createSources({
  apiKey,
  relief,
  graticule,
  tilesUrl,
}: SourceOptions): Record<string, SourceSpecification> {
  const sources: Record<string, SourceSpecification> = {
    [SOURCE.base]:
      tilesUrl === ""
        ? {
            type: "vector",
            // Declared explicitly rather than through tiles.json so `maxzoom`
            // can be capped below the tileset's own z14: everything past z10
            // is street and building data this style never draws.
            tiles: [
              `${MAPTILER_HOST}/tiles/v3/{z}/{x}/{y}.pbf?key=${apiKey}`,
            ],
            minzoom: 0,
            maxzoom: TILE_MAX_ZOOM,
            attribution: ATTRIBUTION,
          }
        : {
            type: "vector",
            // One file, read by byte ranges. MapLibre Native speaks
            // `pmtiles://` itself since iOS 6.10 and we are on 6.26, so there
            // is nothing to install — and it reads the zoom range out of the
            // archive's own header, which is why no `maxzoom` is repeated
            // here: the archive is the authority on what it holds.
            url: `pmtiles://${tilesUrl}`,
            attribution: ATTRIBUTION,
          },
  };

  if (relief) {
    sources[SOURCE.terrain] = {
      type: "raster-dem",
      // Declared tile by tile rather than through tiles.json, for exactly the
      // reason given above: a `url` hands the zoom range to the server, and
      // the elevation tileset's own range runs to z14. It was the one source
      // left uncapped, so it quietly cost more requests at high zoom than the
      // base map it was shading — see `RELIEF_MAX_ZOOM`.
      tiles: [
        `${MAPTILER_HOST}/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${apiKey}`,
      ],
      minzoom: 0,
      maxzoom: RELIEF_MAX_ZOOM,
      // Named here because tiles.json no longer arrives to carry it. The app
      // draws its own credits either way — see `ATTRIBUTION`.
      attribution: ATTRIBUTION,
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
