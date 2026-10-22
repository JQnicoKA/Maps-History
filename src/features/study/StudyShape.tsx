import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useEffect, useState } from "react";

import type { TerritoryFeature } from "../territories/api";
import { palette } from "../../theme/palette";

/**
 * Le temps d'un battement, et celui du fondu qui le porte.
 *
 * Neuf cents millisecondes entre deux états, fondus sur quatre cent cinquante :
 * la forme respire au lieu de clignoter. Un clignotement franc — deux états
 * secs, trois fois par seconde — se lit comme une alarme, et une alarme sur la
 * chose qu'on demande d'identifier presse le lecteur au lieu de l'aider.
 */
const BEAT = 900;
const FADE = 450;

export type StudyShapeProps = {
  shape: TerritoryFeature;
};

/**
 * Le territoire de la question, qui respire sur la planche.
 *
 * Il n'y a pas de marqueur pour un territoire : la forme **est** la question.
 * Elle bat pour se distinguer des lavis du fond de carte, qui sont du même
 * genre d'objet et qui, immobiles, ne diraient pas lequel est demandé.
 *
 * **MapLibre n'anime pas une propriété de peinture depuis React** : il n'y a
 * pas d'`Animated` qui tienne sur un calque natif. C'est donc l'état qui bat,
 * une fois par seconde — assez rare pour ne rien coûter —, et c'est la
 * transition déclarée dans la peinture qui fait le fondu côté natif.
 */
export function StudyShape({ shape }: StudyShapeProps) {
  const [lit, setLit] = useState(true);

  useEffect(() => {
    const beat = setInterval(() => setLit((one) => !one), BEAT);
    return () => clearInterval(beat);
  }, []);

  return (
    <GeoJSONSource
      id="study-shape"
      data={{ type: "FeatureCollection", features: [shape] }}
    >
      {/* Au-dessus des lavis du fond, et non dessous comme eux : ce n'est pas
          un territoire de plus sur la carte, c'est celui qu'on montre. */}
      <Layer
        id="study-shape-fill"
        type="fill"
        paint={{
          "fill-color": palette.wax,
          "fill-opacity": lit ? 0.5 : 0.14,
          "fill-opacity-transition": { duration: FADE, delay: 0 },
        }}
      />
      {/* Le tour, qui bat avec le fond : sans lui, la forme s'éteint au point
          de disparaître dans le creux du battement. */}
      <Layer
        id="study-shape-line"
        type="line"
        paint={{
          "line-color": palette.waxDeep,
          "line-width": 2,
          "line-opacity": lit ? 0.95 : 0.4,
          "line-opacity-transition": { duration: FADE, delay: 0 },
        }}
      />
    </GeoJSONSource>
  );
}
