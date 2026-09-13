import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { FeatureCollection, Point } from "geojson";
import { useMemo } from "react";

import { useTerritoriesAt } from "./useTerritoriesAt";
import { ZOOM } from "../../config/map";
import { fonts } from "../../map/style/typography";
import { useEvents } from "../events/EventsProvider";
import { palette } from "../../theme/palette";

/**
 * What waits for country zoom is not every fief, only the ones a sovereign was
 * standing over.
 *
 * OHM maps the late Middle Ages fief by fief — in 1453 there is no Kingdom of
 * France, no Holy Roman Empire, no Poland-Lithuania, only Nemours, Bar,
 * Luxembourg and their neighbours. Hiding those at world zoom leaves Europe
 * blank from France to Russia. But showing every fief there would shatter the
 * modern world into provinces. `standalone`, computed in the database, tells
 * the two apart: a fief no sovereign covered in its own day is the top rank of
 * its corner of the map and is drawn like one. In 1453 that is 171 entities;
 * in 2000 it is 20.
 *
 * A single zoom expression per property, outermost, with the test on the
 * feature inside each stop: MapLibre crashes on any other arrangement.
 */
const FADE = { from: ZOOM.country - 0.5, to: ZOOM.country + 0.5 };

/**
 * How solid the wash sits on the plate — 0.7 leaves a little under a third of
 * the parchment showing through.
 *
 * It began at 0.32, chosen so the relief and the landcover still read under
 * the colour. That reading came at a price: eight washes at a third of their
 * strength are hard to tell apart, and about one border in seven fell between
 * two polities the hash had given the same colour. Map colouring fixed the
 * second half of that; this is the first.
 *
 * Subordinate fiefs keep the same ratio to the top rank as they always had.
 */
const WASH = { top: 0.8, subordinate: 0.8 * (0.22 / 0.32) };

/** A fief with a sovereign above it — the only thing the zoom holds back. */
const isSubordinate: ExpressionSpecification = [
  "all",
  [">", ["get", "level"], 2],
  ["!", ["to-boolean", ["get", "standalone"]]],
];

const FILL_OPACITY: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  FADE.from,
  ["case", isSubordinate, 0, WASH.top],
  FADE.to,
  ["case", isSubordinate, WASH.subordinate, WASH.top],
];

const EDGE_OPACITY: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  FADE.from,
  ["case", isSubordinate, 0, 0.65],
  FADE.to,
  ["case", isSubordinate, 0.5, 0.65],
];

/** No fading a string: the name is simply absent below its zoom. */
const LABEL: ExpressionSpecification = [
  "step",
  ["zoom"],
  ["case", isSubordinate, "", ["get", "name"]],
  ZOOM.country,
  ["get", "name"],
];

/**
 * Borders as they stood in the year being read — the only political lines on
 * this map. The year comes from the frieze, which is a scrubber rather than a
 * list, so these redraw for dates on which nothing in particular happened.
 *
 * The geometry comes from OpenHistoricalMap but not from its tiles: a single
 * low-zoom tile carries every boundary that ever existed there — 3 300 features
 * where thirty are wanted — and decoding those was enough for iOS to evict the
 * app. `scripts/extract-territories.mjs` pulls a period out once, the database
 * stitches and simplifies it, and the app fetches each polygon at most once per
 * session. Which is also what lets the wash show at world zoom.
 */
export function TerritoryLayers({ detailed }: { detailed: boolean }) {
  const { year } = useEvents();
  const collection = useTerritoriesAt(year, detailed);

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
          paint={{ "fill-color": ["get", "wash"], "fill-opacity": FILL_OPACITY }}
        />
        <Layer
          id="territory-edge"
          type="line"
          beforeId="label-ocean"
          layout={{ "line-join": "round" }}
          paint={{
            "line-color": palette.ink,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1,
              0.6,
              8,
              ["case", isSubordinate, 1, 1.6],
            ],
            "line-opacity": EDGE_OPACITY,
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
            "text-field": LABEL,
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
            // Top rank before subordinates, then the larger of each, when
            // labels compete for room.
            "symbol-sort-key": [
              "+",
              ["case", isSubordinate, 1000, 0],
              ["-", 0, ["get", "area"]],
            ],
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
