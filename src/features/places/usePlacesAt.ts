import { useEffect, useMemo, useRef, useState } from "react";

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

  // Whole years only: the extract has no finer resolution, and rounding turns
  // a drag's worth of near-identical dates into cache hits.
  const at = year === null ? null : Math.round(year);

  useEffect(() => {
    if (at === null) {
      setReference(null);
      setPosed(EMPTY);
      return;
    }

    // A year already read is shown at once: it is in hand, and making the
    // reader wait out the settling delay for it would be waiting on nothing.
    const cached = cache.current.get(at);
    if (cached) setReference(cached);

    let current = true;
    const timer = setTimeout(() => {
      if (!cache.current.has(at)) {
        fetchPlacesAt(at)
          .then((loaded) => {
            cache.current.set(at, loaded);
            while (cache.current.size > CACHE_LIMIT) {
              cache.current.delete(cache.current.keys().next().value!);
            }
            // The previous snapshot stays until this one lands, so stepping
            // through events never flashes an empty plate.
            if (current) setReference(loaded);
          })
          .catch(() => undefined);
      }

      /**
       * Les villes du lecteur à chaque date, et jamais en cache.
       *
       * Elles se comptent en dizaines au lieu de milliers, et elles changent
       * sous le doigt : poser, effacer, copier. Les garder par année voudrait
       * dire vider ce cache-là à chaque geste, ce qui revient à ne pas en
       * avoir. Le jeu de référence, lui, ne bouge jamais.
       */
      fetchMyPlacesAt(at)
        .then((loaded) => {
          if (current) setPosed(loaded);
        })
        .catch(() => undefined);
    }, SETTLE_MS);

    return () => {
      clearTimeout(timer);
      current = false;
    };
    // `mine` fait redemander les siennes : une ville posée doit paraître sans
    // changer d'année. Le jeu de référence est servi par son cache, donc cela
    // ne coûte pas la grosse requête.
  }, [at, mine]);

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
