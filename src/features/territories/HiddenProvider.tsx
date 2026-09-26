import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchHiddenPolities, hidePolity, showPolity } from "./hidden";

type HiddenContextValue = {
  /** Names this account has taken off its map, most recent first. */
  hidden: string[];
  hide: (name: string) => Promise<void>;
  show: (name: string) => Promise<void>;
  /**
   * Rises by one on every change.
   *
   * The map asks the server which territories are in force, and the server
   * now skips what this account has masked. Nothing else about that request
   * changes when the mask does — same year, same zoom — so this is what tells
   * it to ask again.
   */
  mask: number;
};

const HiddenContext = createContext<HiddenContextValue | null>(null);

/**
 * The territories a reader has removed from their own map.
 *
 * Its own provider rather than a corner of `EventsProvider`: what is masked
 * belongs to the map, not to the collection, and the two are loaded, written
 * and invalidated on entirely different occasions.
 */
export function HiddenProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [mask, setMask] = useState(0);

  useEffect(() => {
    let alive = true;
    void fetchHiddenPolities()
      .then((names) => {
        if (!alive) return;
        setHidden(names);
        // Only if there is something to apply: an account that has hidden
        // nothing must not make the map fetch its territories twice at launch.
        if (names.length > 0) setMask((count) => count + 1);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const hide = useCallback(async (name: string) => {
    await hidePolity(name);
    setHidden((current) => [name, ...current.filter((one) => one !== name)]);
    setMask((count) => count + 1);
  }, []);

  const show = useCallback(async (name: string) => {
    await showPolity(name);
    setHidden((current) => current.filter((one) => one !== name));
    setMask((count) => count + 1);
  }, []);

  const value = useMemo(
    () => ({ hidden, hide, show, mask }),
    [hidden, hide, show, mask],
  );

  return (
    <HiddenContext.Provider value={value}>{children}</HiddenContext.Provider>
  );
}

export function useHidden(): HiddenContextValue {
  const value = useContext(HiddenContext);
  if (!value) throw new Error("useHidden must be used inside a HiddenProvider");
  return value;
}
