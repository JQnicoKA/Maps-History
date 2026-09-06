import type { FeatureCollection, LineString } from "geojson";

/** Web Mercator cuts off just past 85° — meridians stop there. */
const MAX_LATITUDE = 85;
/** Segment length in degrees; short segments keep lines straight under projection. */
const SEGMENT = 5;

function range(from: number, to: number, step: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to; value += step) values.push(value);
  return values;
}

/**
 * The latitude/longitude grid printed on atlas plates, built as plain GeoJSON.
 * OpenMapTiles carries no graticule, and a few hundred vertices cost nothing.
 */
export function createGraticule(stepDegrees = 15): FeatureCollection<LineString> {
  const meridians = range(-180, 180, stepDegrees).map((lng) => ({
    type: "Feature" as const,
    properties: { kind: "meridian", degrees: lng },
    geometry: {
      type: "LineString" as const,
      coordinates: range(-MAX_LATITUDE, MAX_LATITUDE, SEGMENT).map(
        (lat) => [lng, lat] as [number, number],
      ),
    },
  }));

  const parallels = range(-75, 75, stepDegrees).map((lat) => ({
    type: "Feature" as const,
    properties: { kind: "parallel", degrees: lat },
    geometry: {
      type: "LineString" as const,
      coordinates: range(-180, 180, SEGMENT).map(
        (lng) => [lng, lat] as [number, number],
      ),
    },
  }));

  return { type: "FeatureCollection", features: [...meridians, ...parallels] };
}
