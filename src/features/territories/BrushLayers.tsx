import type { FeatureCollection, LineString } from "geojson";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import type { Stroke } from "./drawn";
import { palette } from "../../theme/palette";

export type BrushLayersProps = {
  /** Strokes already laid down, and the one under the finger. */
  strokes: Stroke[];
  trail: Stroke;
  /**
   * Ce que le trait en cours fera : ajouter de la peinture, ou en ôter.
   *
   * La gomme ne montre pas son chemin — voir la source du trait, plus bas.
   */
  erasing: boolean;
  /** The brush's width on screen, in points. */
  width: number;
};

/**
 * What has been painted so far, drawn by the map itself.
 *
 * A line layer with round caps and round joins, which is the same shape
 * `ST_Buffer` will make of the stroke when it is saved. The preview is
 * therefore not an approximation of the result — it is the result, drawn by
 * another means, and the reader is never surprised by what they get.
 *
 * Under the labels but over the washes, so a painted region reads as being
 * laid on the plate rather than replacing it.
 */
export function BrushLayers({
  strokes,
  trail,
  erasing,
  width,
}: BrushLayersProps) {
  /**
   * La peinture et le trait en cours, séparés — et c'est la gomme qui l'a
   * voulu.
   *
   * Ils tenaient dans une seule couche, le trait étant simplement ajouté à
   * la liste. Un coup de gomme n'est pas de la peinture : peint en cire, il
   * se confondrait avec ce qu'il va retirer et l'on croirait peindre. Les
   * deux sources portent la même largeur et les mêmes bouts ronds, donc la
   * peinture se dessine exactement comme avant.
   */
  const lines = (from: Stroke[]): FeatureCollection<LineString> => ({
    type: "FeatureCollection",
    features: from
      // A single tap is one point, which is not a line; the database makes a
      // disc of it, but MapLibre would refuse to draw it.
      .filter((stroke) => stroke.length >= 2)
      .map((stroke) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: stroke },
      })),
  });

  return (
    <>
    <GeoJSONSource id="brush" data={lines(strokes)}>
      <Layer
        id="brush-paint"
        type="line"
        beforeId="water"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": palette.wax,
          "line-width": width,
          /**
           * Flat, and that is the point.
           *
           * A translucent stroke darkens wherever it crosses itself, so going
           * over a bay twice left a stain and the paint no longer said what
           * the territory was — only where the hand had lingered. Opacity is
           * set on the layer instead, where it applies once to the whole
           * painting however many strokes it holds.
           */
          "line-opacity": 1,
        }}
      />
    </GeoJSONSource>

    {/* Le trait en cours, et seulement quand il peint.
        ==================================================================

        **La gomme ne laisse pas de trace.** Elle en laissait une, dans le
        papier de la planche, pour annoncer ce qui allait disparaître. Mais
        la peinture s'en va déjà sous le doigt — la liste des traits est
        rognée à mesure, et c'est elle qu'on voit dessous. La traînée ne
        disait donc rien de plus, et posait un voile pâle sur la carte pour
        le redire.

        Le pinceau, lui, garde la sienne : ce qu'il ajoute n'existe pas
        encore ailleurs. */}
    <GeoJSONSource id="brush-trail" data={lines(erasing ? [] : [trail])}>
      <Layer
        id="brush-trail-line"
        type="line"
        beforeId="water"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": palette.wax,
          "line-width": width,
          "line-opacity": 1,
        }}
      />
    </GeoJSONSource>
    </>
  );
}
