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

/**
 * Highest zoom level fetched from the elevation tileset, which runs to z14.
 *
 * Lower than the base on purpose, and it is the cheapest saving on the map.
 * Above this the DEM tile covering the view is stretched instead of replaced:
 * one z7 tile covers the ground of four z8 tiles, sixty-four z10, two hundred
 * and fifty-six z11. So reading a region closely — panning at z9 to z11,
 * which is what a reader does most — costs new base tiles and almost no new
 * relief ones, where it used to cost both in equal measure.
 *
 * The price is a smoother hillshade past z7: the relief is interpolated
 * rather than resolved. On a sepia engraving that is no loss — an engraved
 * plate has no thirty-metre grain — but it is a judgement to be made with
 * the eye. Raise it to 8 if the ridges read as mush.
 */
export const RELIEF_MAX_ZOOM = 7;

/**
 * Combien de tuiles le lecteur garde sous la main, en octets.
 *
 * MapLibre hérite de Mapbox un cache ambiant de **50 Mo**, et c'est beaucoup
 * trop peu pour ce style. Les tuiles ont été pesées le 1er octobre 2026, à
 * l'octet transféré :
 *
 * | zoom | fond vectoriel (gzip) | relief (webp) |
 * |------|-----------------------|---------------|
 * | z1   | 152 Ko                | 144 Ko        |
 * | z3   | 433 Ko                | 211 Ko        |
 * | z5   | **714 Ko**            | 240 Ko        |
 * | z7   | 305 Ko                | 361 Ko        |
 * | z10  | 87 Ko                 | 305 Ko        |
 *
 * À ~300 Ko la tuile en moyenne, 50 Mo n'en tiennent qu'environ **170** — soit
 * une poignée d'écrans à trois échelles. Un lecteur qui parcourt l'Europe a
 * déjà rempli son cache et commence à évincer ses propres tuiles, qu'il
 * repaiera donc à la visite suivante.
 *
 * 250 Mo en tiennent près de **850**, ce qui couvre les régions qu'un lecteur
 * revisite — et c'est le cas normal : on revient sur ses propres événements.
 * Généreux pour un téléphone, mais c'est un cache : le système le purge sous
 * pression, et le pire qu'il puisse arriver est de retélécharger.
 */
export const TILE_CACHE_BYTES = 250 * 1024 * 1024;

export const INITIAL_VIEW = {
  center: [8, 20] as LngLat,
  zoom: 1.4,
} as const;

export const MAP_FEATURES = {
  /**
   * Sepia hillshading, evoking engraved relief.
   *
   * It reads its own tile pyramid, so it is the second cheapest thing to turn
   * off if requests ever become the binding constraint — capped at
   * `RELIEF_MAX_ZOOM`, it now costs a handful of tiles at low zoom and
   * practically nothing above it.
   */
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
 *
 * **`ohm` is no longer loaded.** Its two tables took 76 MB of the 130 the
 * database held — more than everything else together — and were dropped once
 * Cliopatria became the source. Flipping this line back means first running
 * `scripts/extract-territories.mjs` then `scripts/load-territories.mjs`, which
 * rebuild both the tables and the two functions.
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
    // "modified" is not politeness, it is the second half of CC BY: the licence
    // asks that changes be indicated, and the polity names in this database no
    // longer all read as Cliopatria published them.
    TERRITORY_SOURCE === "cliopatria"
      ? "© Cliopatria (CC BY, modified)"
      : "© OpenHistoricalMap",
  );
}
if (MAP_FEATURES.places) CREDITS.push("© OpenHistoricalMap");

export const ATTRIBUTION = [...new Set(CREDITS)].join(" ");
