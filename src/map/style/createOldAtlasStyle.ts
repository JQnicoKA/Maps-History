import type { StyleSpecification } from "@maplibre/maplibre-react-native";

import {
  graticuleLayers,
  labelLayers,
  landLayers,
  reliefLayers,
  waterLayers,
} from "./layers";
import { MAPTILER_HOST, createSources } from "./sources";
import { MAP_FEATURES } from "../../config/map";
import { env } from "../../config/env";

export type OldAtlasStyleOptions = {
  apiKey: string;
  /** Sepia hillshading from terrain tiles. */
  relief?: boolean;
  /** Printed 15° latitude/longitude grid. */
  graticule?: boolean;
  /** Our own PMTiles archive of the base map, when there is one. */
  tilesUrl?: string;
  /** Nos propres dossiers de glyphes, quand nous en avons. */
  glyphsUrl?: string;
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
  tilesUrl = env.tilesUrl,
  glyphsUrl = env.glyphsUrl,
}: OldAtlasStyleOptions): StyleSpecification {
  return {
    version: 8,
    name: "Old Atlas",
    /**
     * Où MapLibre prend la **forme des lettres**, qui n'est pas leur texte.
     *
     * Il dessine sur le GPU et n'a pas accès aux polices du système : pour
     * tracer un `R` il lui faut l'image du `R`, par tranches de 256 points de
     * code. Les noms viennent de Supabase et des tuiles ; ceci est l'alphabet
     * qui les écrit, et sans lui la carte est muette avec ses données
     * intactes.
     *
     * `{fontstack}` est remplacé par la pile **entière**, noms joints par des
     * virgules — d'où un dossier par combinaison, pré-composé par
     * `npm run glyphs`. Voir `scripts/glyph-stacks.mjs`.
     *
     * Renseigné, plus une seule requête de lettres ne part chez MapTiler ;
     * vidé, on y retourne sans rien recompiler d'autre que le bundle.
     */
    glyphs:
      glyphsUrl === ""
        ? `${MAPTILER_HOST}/fonts/{fontstack}/{range}.pbf?key=${apiKey}`
        : `${glyphsUrl}/{fontstack}/{range}.pbf`,
    sources: createSources({ apiKey, relief, graticule, tilesUrl }),
    layers: [
      ...landLayers(),
      ...(relief ? reliefLayers() : []),
      ...waterLayers(),
      ...(graticule ? graticuleLayers() : []),
      ...labelLayers(),
    ],
  };
}
