import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { FeatureCollection, Point } from "geojson";
import { useMemo } from "react";

import { useTerritoriesAt } from "./useTerritoriesAt";
import { ZOOM } from "../../config/map";
import { fonts, HALO } from "../../map/style/typography";
import { useEvents } from "../events/EventsProvider";
import { useHidden } from "./HiddenProvider";
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

/** No fading a string: the name is simply absent below its zoom. */
const LABEL: ExpressionSpecification = [
  "step",
  ["zoom"],
  ["case", isSubordinate, "", ["get", "name"]],
  ZOOM.country,
  ["get", "name"],
];

/**
 * Borders as they stood in the year being read. The year comes from the frieze,
 * which is a scrubber rather than a list, so these redraw for dates on which
 * nothing in particular happened.
 *
 * **No outline is drawn.** A territory is its wash and nothing else, and what
 * separates two of them is that they are different colours — which only works
 * because the washes come from map colouring and no two neighbours can ever
 * share one. Restoring the engraved line means one `line` layer on this source,
 * ink at 0.65, between the fill and the labels.
 *
 * The geometry comes from OpenHistoricalMap but not from its tiles: a single
 * low-zoom tile carries every boundary that ever existed there — 3 300 features
 * where thirty are wanted — and decoding those was enough for iOS to evict the
 * app. `scripts/extract-territories.mjs` pulls a period out once, the database
 * stitches and simplifies it, and the app fetches each polygon at most once per
 * session. Which is also what lets the wash show at world zoom.
 */
export type TerritoryLayersProps = {
  detailed: boolean;
  /** Fired with the name of whatever territory the finger landed on. */
  onTouch?: (name: string) => void;
};

export function TerritoryLayers({ detailed, onTouch }: TerritoryLayersProps) {
  const { year } = useEvents();
  const { mask } = useHidden();
  const collection = useTerritoriesAt(year, detailed, mask);

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
      <GeoJSONSource
        id="territories"
        data={collection}
        // The source reports which feature was under the finger, so nothing
        // here has to hit-test a polygon by hand.
        onPress={(event) => {
          const name = event.nativeEvent.features[0]?.properties?.["name"];
          if (typeof name === "string" && name !== "") onTouch?.(name);
        }}
      >
        {/* Beneath the sea, not above it.
            Cliopatria is digitised at about a point every 25 km, so its
            coastlines only roughly follow the real ones and the wash spills
            into the water — measured at +5,2 % of area for Portugal, +9,3 %
            for Japan. The base style's `water` is an opaque fill drawn before
            this one, so slipping underneath it lets the sea paint over every
            overshoot, at the tiles' own precision and at every zoom, for
            nothing. Inland lakes stop being washed over too. */}
        <Layer
          id="territory-fill"
          type="fill"
          beforeId="water"
          paint={{ "fill-color": ["get", "wash"], "fill-opacity": FILL_OPACITY }}
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
          paint={{ ...HALO, "text-color": palette.ink }}
        />
      </GeoJSONSource>
    </>
  );
}
