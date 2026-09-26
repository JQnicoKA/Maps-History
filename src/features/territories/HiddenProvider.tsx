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
import { drawPolity, eraseDrawn, fetchDrawn, type DrawnPolity, type Stroke } from "./drawn";

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

  /** The territories this account has painted itself. */
  drawn: DrawnPolity[];
  /** Paints one and keeps it. Returns once the map can show it. */
  draw: (options: {
    strokes: Stroke[];
    brushMetres: number;
    name: string;
    from: number;
    to: number;
  }) => Promise<void>;
  erase: (id: string) => Promise<void>;
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
  const [drawn, setDrawn] = useState<DrawnPolity[]>([]);
  const [mask, setMask] = useState(0);

  useEffect(() => {
    let alive = true;
    void Promise.all([fetchHiddenPolities(), fetchDrawn()])
      .then(([names, mine]) => {
        if (!alive) return;
        setHidden(names);
        setDrawn(mine);
        // Only if there is something to apply: an account with nothing hidden
        // and nothing drawn must not make the map fetch its territories twice
        // at launch.
        if (names.length > 0 || mine.length > 0) setMask((count) => count + 1);
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

  const draw = useCallback(
    async (options: {
      strokes: Stroke[];
      brushMetres: number;
      name: string;
      from: number;
      to: number;
    }) => {
      await drawPolity(options);
      // Re-read rather than splice in what we sent: the colour and the label
      // anchor are decided by the database, and only it knows them.
      setDrawn(await fetchDrawn());
      setMask((count) => count + 1);
    },
    [],
  );

  const erase = useCallback(async (id: string) => {
    await eraseDrawn(id);
    setDrawn((current) => current.filter((one) => one.id !== id));
    setMask((count) => count + 1);
  }, []);

  const value = useMemo(
    () => ({ hidden, hide, show, mask, drawn, draw, erase }),
    [hidden, hide, show, mask, drawn, draw, erase],
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
