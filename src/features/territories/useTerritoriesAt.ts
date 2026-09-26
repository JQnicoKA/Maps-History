import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { useEffect, useRef, useState } from "react";

import {
  fetchTerritoriesByIds,
  fetchTerritoryIdsAt,
  type TerritoryFeature,
} from "./api";

export type TerritoryCollection = FeatureCollection<Polygon | MultiPolygon>;

/**
 * Entities kept in memory across dates. Borders are immutable once extracted,
 * so a polygon is worth downloading once per session rather than once per date:
 * two consecutive years usually share every single one of them.
 *
 * Bounded because the full collection spans millennia and would run to tens of
 * megabytes of parsed geometry. Kept well above the busiest single date — 217
 * sovereign entities and 777 fiefs worldwide in 2000 — so the set currently on
 * screen can never be evicted, and browsing does not thrash against the
 * ceiling.
 */
const CACHE_LIMIT = 1200;

/** The top rank of each region, or that plus the fiefs beneath a sovereign. */
const LEVEL = { sovereign: 2, fief: 4 };

/**
 * The territories in force in a given year, assembled from what is already held
 * plus whatever is missing.
 *
 * `detailed` follows the zoom: below country scale the fiefs that sit under a
 * sovereign are neither drawn nor fetched — the ones that sit under nobody
 * always are. Flipping it back and forth costs nothing after the first time:
 * the geometry stays in the cache, only the list of identifiers is asked for
 * again.
 */
export function useTerritoriesAt(
  year: number | null,
  detailed: boolean,
  /**
   * Bumped whenever the reader hides or restores a territory.
   *
   * The list of identifiers is decided by the server, which now skips what
   * this account has masked — so a change to the mask has to make the hook ask
   * again. Nothing else here would notice: the year and the zoom are the same.
   */
  mask = 0,
): TerritoryCollection | null {
  const [collection, setCollection] = useState<TerritoryCollection | null>(null);
  const entities = useRef(new Map<string, TerritoryFeature>());

  useEffect(() => {
    if (year === null) {
      setCollection(null);
      return;
    }

    let current = true;

    (async () => {
      const ids = await fetchTerritoryIdsAt(
        year,
        detailed ? LEVEL.fief : LEVEL.sovereign,
      );
      const missing = ids.filter((id) => !entities.current.has(id));

      for (const feature of await fetchTerritoriesByIds(missing)) {
        entities.current.set(String(feature.properties?.["id"]), feature);
      }

      // Re-inserting marks these as most recently used: a Map keeps insertion
      // order, so eviction below takes the oldest first.
      const features: TerritoryFeature[] = [];
      for (const id of ids) {
        const feature = entities.current.get(id);
        if (!feature) continue;
        entities.current.delete(id);
        entities.current.set(id, feature);
        features.push(feature);
      }

      while (entities.current.size > CACHE_LIMIT) {
        entities.current.delete(entities.current.keys().next().value!);
      }

      // The previous snapshot stays on screen until this one is ready, so
      // stepping through events never flashes an empty map.
      if (current) setCollection({ type: "FeatureCollection", features });
    })().catch(() => undefined);

    return () => {
      current = false;
    };
  }, [year, detailed, mask]);

  return collection;
}
