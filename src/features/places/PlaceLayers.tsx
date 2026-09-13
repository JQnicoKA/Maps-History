import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import { usePlacesAt } from "./usePlacesAt";
import { useEvents } from "../events/EventsProvider";
import { fonts, HALO } from "../../map/style/typography";
import { palette } from "../../theme/palette";

/**
 * A city earns its ring earlier than a town: below these zooms the plate would
 * be a field of dots long before the names became useful.
 *
 * One `step` on the zoom, with the per-kind test inside its stops — MapLibre
 * allows a single zoom-based subexpression per property, and branching on the
 * kind first (two steps, one per branch) crashes the renderer at style load.
 */
const VISIBLE: ExpressionSpecification = [
  "step",
  ["zoom"],
  0,
  3,
  ["case", ["==", ["get", "kind"], "city"], 1, 0],
  5.5,
  1,
];

/**
 * Below its zoom the name is dropped outright rather than faded to nothing: a
 * transparent symbol still claims its box in the collision pass and evicts the
 * lettering around it — the country name first of all.
 */
const LABEL: ExpressionSpecification = [
  "step",
  ["zoom"],
  "",
  3,
  ["case", ["==", ["get", "kind"], "city"], ["get", "name"], ""],
  5.5,
  ["get", "name"],
];

/**
 * A solid ink dot, the way a settlement is marked on an engraved plate.
 *
 * It was a ring — paper fill, ink stroke — which at these sizes reads as a
 * small white blob rather than as a point. A filled dot carries far more weight
 * per pixel, so these radii are well under half what the ring needed.
 *
 * The name does the work; the dot only says precisely where. Hence radii this
 * small — a town at continent zoom is a point and a half across.
 *
 * **0.7 is the floor.** Below it a circle stops covering a whole device pixel
 * even at 3x, so antialiasing renders it as a grey smudge rather than as ink,
 * and the dots lose their bite instead of gaining discretion. Shrink further by
 * raising the zoom at which they appear, not by going under this.
 */
const DOT = {
  city: { near: 0.9, far: 1.7 },
  town: { near: 0.7, far: 1.2 },
};

const RADIUS: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  3,
  ["case", ["==", ["get", "kind"], "city"], DOT.city.near, DOT.town.near],
  9,
  ["case", ["==", ["get", "kind"], "city"], DOT.city.far, DOT.town.far],
];

/**
 * Settlements as they stood in the year being read. The base tileset's own
 * place labels were removed from the style: they are today's, and this map
 * never shows two epochs at once.
 */
export function PlaceLayers() {
  const { year } = useEvents();
  const collection = usePlacesAt(year);

  if (!collection) return null;

  return (
    <GeoJSONSource id="places" data={collection}>
      <Layer
        id="place-dot"
        type="circle"
        beforeId="label-ocean"
        paint={{
          "circle-radius": RADIUS,
          "circle-color": palette.ink,
          "circle-opacity": VISIBLE,
        }}
      />
      <Layer
        id="place-label"
        type="symbol"
        layout={{
          "text-field": LABEL,
          "text-font": fonts.place,
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            ["case", ["==", ["get", "kind"], "city"], 10, 9],
            10,
            ["case", ["==", ["get", "kind"], "city"], 14, 12],
          ],
          "text-anchor": "left",
          "text-offset": [0.6, 0.1],
          "text-max-width": 7,
          "text-padding": 3,
          // Cities win the space when names collide.
          "symbol-sort-key": ["case", ["==", ["get", "kind"], "city"], 0, 1],
        }}
        paint={{ ...HALO, "text-color": palette.ink }}
      />
    </GeoJSONSource>
  );
}
