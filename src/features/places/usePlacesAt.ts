import { useEffect, useRef, useState } from "react";

import { fetchPlacesAt, type PlaceCollection } from "./api";

/**
 * A snapshot is a few hundred kilobytes of points — small enough to keep whole
 * per date, unlike territories whose geometry forced a per-entity cache.
 */
const CACHE_LIMIT = 12;

/**
 * Settlements are the heaviest layer on the plate: 2,2 Mo and three quarters of
 * a second for a modern date, against well under a megabyte for the borders.
 * Dragging the frieze across the centuries would ask for one every time the
 * year moved, so the request waits for the year to hold still. The borders keep
 * following the finger; the towns catch up when it stops.
 */
const SETTLE_MS = 350;

export function usePlacesAt(year: number | null): PlaceCollection | null {
  const [collection, setCollection] = useState<PlaceCollection | null>(null);
  const cache = useRef(new Map<number, PlaceCollection>());

  // Whole years only: the extract has no finer resolution, and rounding turns
  // a drag's worth of near-identical dates into cache hits.
  const at = year === null ? null : Math.round(year);

  useEffect(() => {
    if (at === null) {
      setCollection(null);
      return;
    }

    const cached = cache.current.get(at);
    if (cached) {
      setCollection(cached);
      return;
    }

    let current = true;
    const timer = setTimeout(() => {
      fetchPlacesAt(at)
        .then((loaded) => {
          cache.current.set(at, loaded);
          while (cache.current.size > CACHE_LIMIT) {
            cache.current.delete(cache.current.keys().next().value!);
          }
          // The previous snapshot stays until this one lands, so stepping
          // through events never flashes an empty plate.
          if (current) setCollection(loaded);
        })
        .catch(() => undefined);
    }, SETTLE_MS);

    return () => {
      clearTimeout(timer);
      current = false;
    };
  }, [at]);

  return collection;
}
