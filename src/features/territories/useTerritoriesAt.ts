import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { useEffect, useRef, useState } from "react";

import {
  fetchTerritoriesByIds,
  fetchTerritoryIdsAt,
  type TerritoryFeature,
} from "./api";
import { latestOnly, wait, type LatestOnly } from "../../lib/latestOnly";
import { yearOf } from "../events/historicalDate";
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

  // L'année pleine, comme la frise l'affiche : les frontières finissent à une
  // année incluse, et décembre 487 passé tel quel (487,98) effaçait celles qui
  // s'arrêtent en 487. Un glissement dans l'année ne redemande plus rien.
  const at = year === null ? null : yearOf(year);

  /**
   * Une seule passe à la fois, vers la dernière année demandée.
   *
   * Voir `latestOnly` : glisser de 400 à 2000 lançait une passe par année
   * survolée, toutes en même temps, et le serveur les laissait toutes tomber.
   * Une passe qui finit pendant le glissement est quand même posée — c'est une
   * vraie planche, plus proche du doigt que la précédente — mais seule la
   * dernière éteint le témoin.
   */
  const pump = useRef<LatestOnly<Ask> | null>(null);
  if (pump.current === null) {
    pump.current = latestOnly<Ask>(async (ask, { stale, cancelled }) => {
      for (let attempt = 0; ; attempt++) {
        try {
          const features = await assemble(ask, entities.current);
          if (cancelled()) return;
          setCollection({ type: "FeatureCollection", features });
          if (!stale()) setLoading(false);
          return;
        } catch {
          // Plus la peine d'insister pour une année déjà quittée.
          if (stale() || cancelled()) return;
          if (attempt >= RETRIES) {
            setLoading(false);
            return;
          }
          await wait(RETRY_MS * (attempt + 1));
          if (stale() || cancelled()) return;
        }
      }
    });
  }

  useEffect(() => {
    if (at === null) {
      pump.current?.stop();
      setCollection(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    pump.current?.want({ at, detailed });
  }, [at, detailed, mask]);

  useEffect(() => () => pump.current?.stop(), []);

  return { collection, loading };
}

type Ask = { at: number; detailed: boolean };

/** Des essais en plus du premier, pour l'année où l'on s'est arrêté. */
const RETRIES = 2;
const RETRY_MS = 1500;

/**
 * Les territoires d'une année, pris dans le cache ou demandés pour ce qui manque.
 */
async function assemble(
  { at, detailed }: Ask,
  entities: Map<string, TerritoryFeature>,
): Promise<TerritoryFeature[]> {
  // Asked together: the reference set is a list of identifiers, the
  // reader's own territories come whole. Neither waits on the other.
  const [ids, mine] = await Promise.all([
    fetchTerritoryIdsAt(at, detailed ? LEVEL.fief : LEVEL.sovereign),
    fetchDrawnAt(at),
  ]);
  const missing = ids.filter((id) => !entities.has(id));

  // Gardés morceau par morceau : si l'un manque son délai, un nouvel essai ne
  // redemande que celui-là.
  await fetchTerritoriesByIds(missing, (arrived) => {
    for (const feature of arrived) {
      entities.set(String(feature.properties?.["id"]), feature);
    }
  });

  // Re-inserting marks these as most recently used: a Map keeps insertion
  // order, so eviction below takes the oldest first.
  const features: TerritoryFeature[] = [];
  for (const id of ids) {
    const feature = entities.get(id);
    if (!feature) continue;
    entities.delete(id);
    entities.set(id, feature);
    features.push(feature);
  }

  while (entities.size > CACHE_LIMIT) {
    entities.delete(entities.keys().next().value!);
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
  return [...features, ...drawn];
}
