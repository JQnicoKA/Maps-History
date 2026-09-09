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
 * megabytes of parsed geometry. Kept well above the busiest single date — 216
 * sovereign entities worldwide in 2020 — so the set currently on screen can
 * never be evicted, and browsing does not thrash against the ceiling.
 */
const CACHE_LIMIT = 800;

/**
 * The territories in force in a given year, assembled from what is already held
 * plus whatever is missing.
 */
export function useTerritoriesAt(year: number | null): TerritoryCollection | null {
  const [collection, setCollection] = useState<TerritoryCollection | null>(null);
  const entities = useRef(new Map<string, TerritoryFeature>());

  useEffect(() => {
    if (year === null) {
      setCollection(null);
      return;
    }

    let current = true;

    (async () => {
      const ids = await fetchTerritoryIdsAt(year);
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
  }, [year]);

  return collection;
}
