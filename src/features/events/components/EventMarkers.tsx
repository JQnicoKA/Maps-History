import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { FeatureCollection, Point } from "geojson";
import { useMemo } from "react";

import { useEvents } from "../EventsProvider";
import { effectiveImportance } from "../filtering";
import { palette } from "../../../theme/palette";

/** Layer the map is hit-tested against when the reader taps an event. */
export const EVENT_HIT_LAYER = "events-hit";
const SOURCE = "events";

/** Radius in points, by how much the event matters in the current view. */
const RADIUS: ExpressionSpecification = [
  "match",
  ["get", "importance"],
  "high", 7,
  "medium", 5.5,
  4,
];

const grown = (by: number): ExpressionSpecification => ["+", RADIUS, by];

/**
 * Every event is drawn from a single GeoJSON source rather than as N React
 * annotations: the renderer keeps pan and zoom smooth no matter how many
 * events are on the plate, and importance becomes a styling expression.
 */
export function EventMarkers() {
  const { visibleEvents, filters, selectedEvent } = useEvents();

  const data = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: visibleEvents.map((event) => ({
        type: "Feature",
        properties: {
          id: event.id,
          importance: effectiveImportance(event, filters.folderId),
          selected: event.id === selectedEvent?.id,
        },
        geometry: {
          type: "Point",
          coordinates: [event.longitude, event.latitude],
        },
      })),
    }),
    [visibleEvents, filters.folderId, selectedEvent],
  );

  return (
    <GeoJSONSource id={SOURCE} data={data}>
      {/* Invisible and generous: a 6pt dot is not a tap target. */}
      <Layer
        id={EVENT_HIT_LAYER}
        type="circle"
        paint={{ "circle-radius": 18, "circle-opacity": 0 }}
      />
      <Layer
        id="events-halo"
        type="circle"
        paint={{
          "circle-radius": grown(4),
          "circle-color": palette.paperLight,
          "circle-opacity": 0.55,
          "circle-blur": 0.4,
        }}
      />
      <Layer
        id="events-dot"
        type="circle"
        paint={{
          "circle-radius": RADIUS,
          "circle-color": palette.paperLight,
          "circle-stroke-color": palette.ink,
          "circle-stroke-width": 1.5,
        }}
      />
      {/* Sealing wax marks the event under the reader's eye. */}
      <Layer
        id="events-selected"
        type="circle"
        filter={["==", ["get", "selected"], true]}
        paint={{
          "circle-radius": grown(1.5),
          "circle-color": palette.wax,
          "circle-stroke-color": palette.paperLight,
          "circle-stroke-width": 2,
        }}
      />
    </GeoJSONSource>
  );
}
