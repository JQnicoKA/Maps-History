import { useEffect, useRef, useState } from "react";

import { fetchPlacesAt, type PlaceCollection } from "./api";

/**
 * A snapshot is a few hundred kilobytes of points — small enough to keep whole
 * per date, unlike territories whose geometry forced a per-entity cache.
 */
const CACHE_LIMIT = 8;

export function usePlacesAt(year: number | null): PlaceCollection | null {
  const [collection, setCollection] = useState<PlaceCollection | null>(null);
  const cache = useRef(new Map<number, PlaceCollection>());

  useEffect(() => {
    if (year === null) {
      setCollection(null);
      return;
    }

    const cached = cache.current.get(year);
    if (cached) {
      setCollection(cached);
      return;
    }

    let current = true;
    fetchPlacesAt(year)
      .then((loaded) => {
        cache.current.set(year, loaded);
        while (cache.current.size > CACHE_LIMIT) {
          cache.current.delete(cache.current.keys().next().value!);
        }
        // The previous snapshot stays until this one lands, so stepping through
        // events never flashes an empty plate.
        if (current) setCollection(loaded);
      })
      .catch(() => undefined);

    return () => {
      current = false;
    };
  }, [year]);

  return collection;
}
