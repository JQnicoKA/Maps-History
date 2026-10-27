import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { useEffect, useRef, useState } from "react";

import {
  fetchTerritoriesByIds,
  fetchTerritoryIdsAt,
  type TerritoryFeature,
} from "./api";
import { fetchDrawnAt } from "./drawn";

export type TerritoryCollection = FeatureCollection<Polygon | MultiPolygon>;

/**
 * Les territoires de l'année, et si l'on attend encore ceux-là.
 *
 * Deux valeurs et non une, parce que les deux ne disent pas la même chose au
 * même moment : **l'ancienne planche reste à l'écran pendant que la nouvelle
 * arrive** — voir le commentaire du `setCollection` plus bas, c'est ce qui
 * évite de clignoter en noir à chaque pas. Donc `collection` ne renseigne en
 * rien sur l'attente : elle montre quelque chose de vrai, mais d'une autre
 * année.
 */
export type TerritoriesAt = {
  collection: TerritoryCollection | null;
  /** Vrai de la demande à la pose, pour qui veut le faire savoir. */
  loading: boolean;
};

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
): TerritoriesAt {
  const [collection, setCollection] = useState<TerritoryCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const entities = useRef(new Map<string, TerritoryFeature>());

  useEffect(() => {
    if (year === null) {
      setCollection(null);
      setLoading(false);
      return;
    }

    let current = true;
    setLoading(true);

    (async () => {
      try {
        // Asked together: the reference set is a list of identifiers, the
        // reader's own territories come whole. Neither waits on the other.
        const [ids, mine] = await Promise.all([
          fetchTerritoryIdsAt(year, detailed ? LEVEL.fief : LEVEL.sovereign),
          fetchDrawnAt(year),
        ]);
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

        /**
         * The reader's own territories last, and therefore on top.
         *
         * A painted region is almost always drawn over something — that is the
         * point of drawing it — and it would be strange for the reference set
         * to cover what the reader put there deliberately.
         *
         * They are never cached: there are a few dozen at most, they arrive
         * whole, and they change as soon as one is drawn or erased.
         */
        const drawn = (mine.features ?? []) as TerritoryFeature[];

        // The previous snapshot stays on screen until this one is ready, so
        // stepping through events never flashes an empty map.
        if (current) {
          setCollection({
            type: "FeatureCollection",
            features: [...features, ...drawn],
          });
        }
      } finally {
        /**
         * Seulement si cette passe est encore la bonne.
         *
         * Changer d'année pendant un chargement laisse la précédente passe
         * finir dans le vide — `current` est déjà faux et son résultat est
         * jeté. Si elle éteignait quand même le témoin, elle éteindrait celui
         * de la passe en cours, et la roue s'arrêterait de tourner devant une
         * carte qui charge encore.
         */
        if (current) setLoading(false);
      }
    })().catch(() => undefined);

    return () => {
      current = false;
    };
  }, [year, detailed, mask]);

  return { collection, loading };
}
