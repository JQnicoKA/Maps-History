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
  /**
   * Historical borders from OpenHistoricalMap, shown at the date of the event
   * being read. Live vector tiles — nothing is imported or stored.
   */
  territories: true,
  /**
   * Historical settlements from OpenHistoricalMap, shown at the date of the
   * event being read. The base tileset's modern places are off either way.
   */
  places: true,
} as const;

/**
 * Where the historical borders come from. The two sets are read through the
 * same pair of functions and expose the same feature properties, so switching
 * is this one line.
 *
 * - `cliopatria` — Seshat Global History Databank, CC BY 4.0. 12 043 versions
 *   of 1 540 polities from 3400 BCE to 2024, all at one political rank, with a
 *   single date costing well under a megabyte.
 * - `ohm` — OpenHistoricalMap, CC0. Finer tracing and period-correct endonyms
 *   where it exists, but the late Middle Ages are mapped fief by fief and whole
 *   regions have nothing at all: no Kingdom of France between 1051 and 1659.
 */
export const TERRITORY_SOURCE: "cliopatria" | "ohm" = "cliopatria";

/** The function pair the map reads its borders from. */
export const TERRITORY_RPC =
  TERRITORY_SOURCE === "cliopatria"
    ? { ids: "polity_ids_at", byIds: "polities_by_ids" }
    : { ids: "territory_ids_at", byIds: "territories_by_ids" };

const CREDITS = ["© MapTiler", "© OpenStreetMap"];
if (MAP_FEATURES.territories) {
  CREDITS.push(
    TERRITORY_SOURCE === "cliopatria" ? "© Cliopatria (CC BY)" : "© OpenHistoricalMap",
  );
}
if (MAP_FEATURES.places) CREDITS.push("© OpenHistoricalMap");

export const ATTRIBUTION = [...new Set(CREDITS)].join(" ");
