import { useEffect, useMemo, useRef, useState } from "react";

import { latestOnly, wait, type LatestOnly } from "../../lib/latestOnly";
import { yearOf } from "../events/historicalDate";
import { fetchPlacesAt, type PlaceCollection } from "./api";
import { fetchMyPlacesAt } from "./mine";
import { useMyPlaces } from "./MyPlacesProvider";

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

const EMPTY: PlaceCollection = { type: "FeatureCollection", features: [] };

export function usePlacesAt(year: number | null): PlaceCollection | null {
  const { mine, maskedIds } = useMyPlaces();
  const [reference, setReference] = useState<PlaceCollection | null>(null);
  const [posed, setPosed] = useState<PlaceCollection>(EMPTY);
  const cache = useRef(new Map<number, PlaceCollection>());

  // Whole years only: the extract has no finer resolution, and keeping only
  // the year turns a drag's worth of near-identical dates into cache hits.
  const at = year === null ? null : yearOf(year);

  /**
   * Une passe à la fois, vers la dernière année : voir `latestOnly`. Le délai
   * de pose se tient dans la passe elle-même, et une année quittée pendant ce
   * délai ou pendant le chargement n'est jamais posée par-dessus la bonne.
   */
  const pump = useRef<LatestOnly<number> | null>(null);
  if (pump.current === null) {
    pump.current = latestOnly<number>(async (year, { stale, cancelled }) => {
      const gone = () => stale() || cancelled();

      // A year already read is shown at once: it is in hand, and making the
      // reader wait out the settling delay for it would be waiting on nothing.
      const cached = cache.current.get(year);
      if (cached) setReference(cached);

      await wait(SETTLE_MS);
      if (gone()) return;

      if (!cached) {
        const loaded = await fetchPlacesAt(year).catch(() => null);
        if (loaded) {
          cache.current.set(year, loaded);
          while (cache.current.size > CACHE_LIMIT) {
            cache.current.delete(cache.current.keys().next().value!);
          }
          // The previous snapshot stays until this one lands, so stepping
          // through events never flashes an empty plate.
          if (!gone()) setReference(loaded);
        }
        if (gone()) return;
      }

      /**
       * Les villes du lecteur à chaque date, et jamais en cache.
       *
       * Elles se comptent en dizaines au lieu de milliers, et elles changent
       * sous le doigt : poser, effacer, copier. Les garder par année voudrait
       * dire vider ce cache-là à chaque geste, ce qui revient à ne pas en
       * avoir. Le jeu de référence, lui, ne bouge jamais.
       */
      const posedNow = await fetchMyPlacesAt(year).catch(() => null);
      if (posedNow && !gone()) setPosed(posedNow);
    });
  }

  useEffect(() => {
    if (at === null) {
      pump.current?.stop();
      setReference(null);
      setPosed(EMPTY);
      return;
    }
    pump.current?.want(at);
    // `mine` fait redemander les siennes : une ville posée doit paraître sans
    // changer d'année. Le jeu de référence est servi par son cache, donc cela
    // ne coûte pas la grosse requête.
  }, [at, mine]);

  useEffect(() => () => pump.current?.stop(), []);

  return useMemo(() => {
    if (reference === null) {
      return posed.features.length === 0 ? null : posed;
    }

    /**
     * Le masque s'applique ici et non au serveur.
     *
     * Une année de lieux pèse 2,2 Mo et reste en cache tant qu'on ne change
     * pas d'année ; le masque, lui, change dès qu'on touche une ville.
     * Filtrer là-bas rendrait tout le cache caduc à chaque masquage — pour
     * une liste qui tient dans une poignée d'entiers.
     */
    const kept =
      maskedIds.size === 0
        ? reference.features
        : reference.features.filter((feature) => {
            const ohm = feature.properties?.["ohm"];
            return typeof ohm !== "number" || !maskedIds.has(ohm);
          });

    return {
      type: "FeatureCollection",
      // Les siennes en dernier, donc par-dessus : ce qu'un lecteur a posé
      // lui-même gagne la place quand deux noms se disputent le même coin.
      features: [...kept, ...posed.features],
    };
  }, [reference, posed, maskedIds]);
}
