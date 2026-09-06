import type { LngLat } from "@maplibre/maplibre-react-native";

/**
 * Reference zoom levels for the world → continent → country → region range this
 * prototype targets. Street and building detail is deliberately out of scope.
 */
export const ZOOM = {
  min: 0,
  max: 11,
  world: 1,
  continent: 3,
  country: 5,
  region: 8,
} as const;

/**
 * Highest zoom level fetched from the vector tile server. Tiles are overzoomed
 * above it, which keeps geometry crisp while avoiding the heavy z11–z14 tiles
 * that only carry street-level data we never draw.
 */
export const TILE_MAX_ZOOM = 10;

export const INITIAL_VIEW = {
  center: [8, 20] as LngLat,
  zoom: 1.4,
} as const;

export const MAP_FEATURES = {
  /** Sepia hillshading, evoking engraved relief. Costs one extra tile request per tile. */
  relief: true,
  /** 15° latitude/longitude grid, as printed on atlas plates. */
  graticule: true,
  /** Paper grain + vignette drawn above the map. */
  paperTexture: true,
} as const;

export const ATTRIBUTION = "© MapTiler © OpenStreetMap contributors";
