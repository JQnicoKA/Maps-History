import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { FeatureCollection, Point } from "geojson";
import { useMemo } from "react";

import { useTerritoriesAt } from "./useTerritoriesAt";
import { fonts } from "../../map/style/typography";
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

  /**
   * One label anchor per entity, not per polygon: MapLibre labels every part of
   * a MultiPolygon, and the Byzantine Empire has 58 of them. The anchor sits on
   * the largest part, computed server-side with ST_PointOnSurface.
   */
  const anchors = useMemo<FeatureCollection<Point> | null>(() => {
    if (!collection) return null;
    return {
      type: "FeatureCollection",
      features: collection.features.flatMap((feature) => {
        const anchor = feature.properties?.["anchor"] as
          [number, number] | undefined;
        if (!anchor) return [];
        return [
          {
            type: "Feature" as const,
            properties: feature.properties,
            geometry: { type: "Point" as const, coordinates: anchor },
          },
        ];
      }),
    };
  }, [collection]);

  if (!collection || !anchors) return null;

  return (
    <>
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

      <GeoJSONSource id="territory-anchors" data={anchors}>
        {/* The only political naming on this map, and it is period-correct:
            "Francia occidentalis" in 900, not "FRANCE". Drawn from the anchor
            points rather than the polygons — one name per polity instead of one
            per island. Sized by area, the way an atlas gives an empire larger
            letters than a duchy. No `beforeId`, so these sit above the rest of
            the lettering. */}
        <Layer
          id="territory-label"
          type="symbol"
          layout={{
            "text-field": ["get", "name"],
            "text-font": fonts.country,
            "text-transform": "uppercase",
            "text-letter-spacing": 0.18,
            "text-max-width": 7,
            "text-padding": 4,
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1,
              ["interpolate", ["linear"], ["get", "area"], 0, 7.5, 60, 13],
              6,
              ["interpolate", ["linear"], ["get", "area"], 0, 11, 60, 19],
            ],
            // Larger polities first when labels compete for room.
            "symbol-sort-key": ["-", 0, ["get", "area"]],
          }}
          paint={{
            "text-color": palette.ink,
            "text-halo-color": palette.paperLight,
            "text-halo-width": 1.4,
            "text-halo-blur": 0.6,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
