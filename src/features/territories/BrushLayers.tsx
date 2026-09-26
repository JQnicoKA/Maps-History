import type { FeatureCollection, LineString } from "geojson";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import type { Stroke } from "./drawn";
import { palette } from "../../theme/palette";

export type BrushLayersProps = {
  /** Strokes already laid down, and the one under the finger. */
  strokes: Stroke[];
  trail: Stroke;
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
export function BrushLayers({ strokes, trail, width }: BrushLayersProps) {
  const all = trail.length > 0 ? [...strokes, trail] : strokes;
  const painted: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: all
      // A single tap is one point, which is not a line; the database makes a
      // disc of it, but MapLibre would refuse to draw it.
      .filter((stroke) => stroke.length >= 2)
      .map((stroke) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: stroke },
      })),
  };

  return (
    <GeoJSONSource id="brush" data={painted}>
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
  );
}
