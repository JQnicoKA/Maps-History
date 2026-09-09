import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import { usePlacesAt } from "./usePlacesAt";
import { useEvents } from "../events/EventsProvider";
import { toSortKey } from "../events/historicalDate";
import { fonts } from "../../map/style/typography";
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

const RADIUS: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  3,
  ["case", ["==", ["get", "kind"], "city"], 2, 1.4],
  9,
  ["case", ["==", ["get", "kind"], "city"], 3.4, 2.4],
];

/**
 * Settlements as they stood on the date of the event being read. The base
 * tileset's own place labels were removed from the style: they are today's, and
 * this map never shows two epochs at once.
 */
export function PlaceLayers() {
  const { selectedEvent } = useEvents();
  const collection = usePlacesAt(
    selectedEvent ? toSortKey(selectedEvent.start) : null,
  );

  if (!collection) return null;

  return (
    <GeoJSONSource id="places" data={collection}>
      <Layer
        id="place-dot"
        type="circle"
        beforeId="label-ocean"
        paint={{
          "circle-radius": RADIUS,
          "circle-color": palette.paperLight,
          "circle-stroke-color": palette.ink,
          "circle-stroke-width": 1,
          "circle-opacity": VISIBLE,
          "circle-stroke-opacity": VISIBLE,
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
        paint={{
          "text-color": palette.ink,
          "text-halo-color": palette.paperLight,
          "text-halo-width": 1.2,
          "text-halo-blur": 0.6,
        }}
      />
    </GeoJSONSource>
  );
}
