import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  addPlace,
  erasePlace,
  fetchMaskedPlaces,
  fetchMyPlaces,
  maskPlace,
  sharePlace,
  unmaskPlace,
  type MaskedPlace,
  type MyPlace,
} from "./mine";

type MyPlacesContextValue = {
  /** Les villes que ce compte a posées. */
  mine: MyPlace[];
  /** Les lieux de référence qu'il a ôtés de sa carte. */
  masked: MaskedPlace[];
  /**
   * Les mêmes, en identités seules — ce avec quoi la planche trie.
   *
   * Dérivé plutôt que tenu à part : deux listes à garder d'accord pour une
   * projection d'une ligne, c'est une divergence qui attend son heure.
   */
  maskedIds: ReadonlySet<number>;

  add: (place: {
    name: string;
    longitude: number;
    latitude: number;
    from: number;
    to: number | null;
  }) => Promise<void>;
  erase: (id: string) => Promise<void>;
  /** Ouvre une ville à la bibliothèque, ou l'en soustrait. */
  share: (id: string, shared: boolean) => Promise<void>;
  mask: (ohm: number) => Promise<void>;
  unmask: (ohm: number) => Promise<void>;
  /**
   * Relit ce que ce compte a posé.
   *
   * Pour les lignes qui arrivent par une route que ce fournisseur ignore —
   * une ville copiée depuis la communauté. La carte, elle, n'a pas besoin
   * qu'on le lui dise : elle redemande son année et voit la copie aussitôt.
   */
  reload: () => Promise<void>;
};

const MyPlacesContext = createContext<MyPlacesContextValue | null>(null);

/**
 * Ce qu'un lecteur a changé aux villes de sa carte.
 *
 * Son fournisseur à lui, et non un coin de `HiddenProvider` : celui-ci tient
 * les territoires, et les deux se chargent, s'écrivent et se périment à des
 * moments sans rapport. Même forme pourtant, à dessein — qui sait lire l'un
 * sait lire l'autre.
 */
export function MyPlacesProvider({ children }: { children: ReactNode }) {
  const [mine, setMine] = useState<MyPlace[]>([]);
  const [masked, setMasked] = useState<MaskedPlace[]>([]);

  useEffect(() => {
    let alive = true;
    void Promise.all([fetchMyPlaces(), fetchMaskedPlaces()])
      .then(([posed, hidden]) => {
        if (!alive) return;
        setMine(posed);
        setMasked(hidden);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const add = useCallback(
    async (place: {
      name: string;
      longitude: number;
      latitude: number;
      from: number;
      to: number | null;
    }) => {
      await addPlace(place);
      // Relu plutôt que recousu sur place : l'identifiant et le défaut de
      // partage sont décidés par la base, et elle seule les connaît.
      setMine(await fetchMyPlaces());
    },
    [],
  );

  const erase = useCallback(async (id: string) => {
    await erasePlace(id);
    setMine((current) => current.filter((one) => one.id !== id));
  }, []);

  const share = useCallback(async (id: string, shared: boolean) => {
    await sharePlace(id, shared);
    // Un booléen est tout ce qui a changé.
    setMine((current) =>
      current.map((one) => (one.id === id ? { ...one, shared } : one)),
    );
  }, []);

  const mask = useCallback(async (ohm: number) => {
    await maskPlace(ohm);
    // D'abord sans attendre : c'est `maskedIds` qui ôte la pastille de la
    // planche, et la ville doit partir sous le doigt. Le nom n'est pas su
    // ici — la planche l'avait, pas ce fournisseur — d'où la relecture qui
    // suit, pour que la liste des retirées sache quoi écrire.
    setMasked((current) => [
      { ohm, name: null },
      ...current.filter((one) => one.ohm !== ohm),
    ]);
    setMasked(await fetchMaskedPlaces());
  }, []);

  const unmask = useCallback(async (ohm: number) => {
    await unmaskPlace(ohm);
    setMasked((current) => current.filter((one) => one.ohm !== ohm));
  }, []);

  const reload = useCallback(async () => {
    setMine(await fetchMyPlaces());
  }, []);

  const maskedIds = useMemo(
    () => new Set(masked.map((one) => one.ohm)),
    [masked],
  );

  const value = useMemo(
    () => ({
      mine,
      masked,
      maskedIds,
      add,
      erase,
      share,
      mask,
      unmask,
      reload,
    }),
    [mine, masked, maskedIds, add, erase, share, mask, unmask, reload],
  );

  return (
    <MyPlacesContext.Provider value={value}>
      {children}
    </MyPlacesContext.Provider>
  );
}

export function useMyPlaces(): MyPlacesContextValue {
  const value = useContext(MyPlacesContext);
  if (!value) {
    throw new Error("useMyPlaces must be used inside a MyPlacesProvider");
  }
  return value;
}
