import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import { useTerritoriesAt } from "./useTerritoriesAt";
import { useEvents } from "../events/EventsProvider";
import { toSortKey } from "../events/historicalDate";
import { palette } from "../../theme/palette";

/**
 * Sovereign borders as they stood on the date of the event being read — the
 * only political lines on this map.
 *
 * The geometry comes from OpenHistoricalMap but not from its tiles: a single
 * low-zoom tile carries every boundary that ever existed there — 3 300 features
 * where thirty are wanted — and decoding those was enough for iOS to evict the
 * app. `scripts/extract-territories.mjs` pulls a period out once, the database
 * stitches and simplifies it, and the app fetches each polygon at most once per
 * session. Which is also what lets the wash show at world zoom.
 */
export function TerritoryLayers() {
  const { selectedEvent } = useEvents();
  const collection = useTerritoriesAt(
    selectedEvent ? toSortKey(selectedEvent.start) : null,
  );

  if (!collection) return null;

  return (
    <GeoJSONSource id="territories" data={collection}>
      <Layer
        id="territory-fill"
        type="fill"
        beforeId="label-ocean"
        paint={{ "fill-color": ["get", "wash"], "fill-opacity": 0.32 }}
      />
      <Layer
        id="territory-edge"
        type="line"
        beforeId="label-ocean"
        layout={{ "line-join": "round" }}
        paint={{
          "line-color": palette.ink,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 8, 1.6],
          "line-opacity": 0.65,
        }}
      />
    </GeoJSONSource>
  );
}
