import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** A point on the plate. The same pair everything placed on it carries. */
export type Point = { longitude: number; latitude: number };

/** A point and how far around it — what the catalogue's region filter is. */
export type Zone = Point & { metres: number };

type PlacementContextValue = {
  /**
   * True while the reader is aiming at the map.
   *
   * Every sheet reads this and stands aside: the whole screen is the control
   * during a placement, and a panel covering half of it is a panel covering
   * half the world.
   */
  aiming: boolean;
  /**
   * Hands the screen over to the reticle, and resolves with the point the
   * reader confirmed — or null if they backed out.
   */
  place: () => Promise<Point | null>;
  /**
   * The same, with a radius to set alongside the point.
   *
   * Asked for on the map rather than in a list of distances, because a radius
   * is the one thing nobody can picture from a number: "five hundred
   * kilometres" means something once it is drawn over the coastlines.
   */
  placeRegion: (from: Point | null, metres: number) => Promise<Zone | null>;
  /** What the reticle is being asked for, while it is up. */
  asking: { kind: "point" } | { kind: "zone"; from: Point | null; metres: number } | null;
  /** Answered by whoever owns the reticle. Not for the forms to call. */
  settle: (answer: Point | Zone | null) => void;
  /**
   * Where the plate is centred, kept up to date by the screen that draws it.
   *
   * A ref and not state: it changes on every settled gesture, and nothing
   * should re-render because somebody panned. Panels that want to ask "what
   * is there, near here" read it at the moment they ask.
   */
  looking: { current: Point | null };
};

const PlacementContext = createContext<PlacementContextValue | null>(null);

/**
 * One way to answer "where?", wherever the question is asked.
 *
 * Events have always been placed by moving the map under a fixed crosshair,
 * and the plumbing for it ran through the screen: a flag, a draft position,
 * two callbacks threaded down into the form. That worked while one form asked
 * the question. People are placed now too, and their card sits two sheets
 * deep — threading the same four things down there would have meant passing
 * a location through a list manager that has no business knowing about one.
 *
 * So the question is asked as a question. A form awaits `place()`, the screen
 * shows the reticle, and the answer comes back to the one who asked. Nobody
 * in between has to carry it.
 */
export function PlacementProvider({ children }: { children: ReactNode }) {
  const [asking, setAsking] = useState<
    { kind: "point" } | { kind: "zone"; from: Point | null; metres: number } | null
  >(null);
  /** Whoever is waiting for an answer, if anyone. */
  const waiting = useRef<((answer: Point | Zone | null) => void) | null>(null);
  const looking = useRef<Point | null>(null);

  const place = useCallback(() => {
    // A second question while the first is unanswered should not leave the
    // first one waiting for ever: it is told nothing came of it.
    waiting.current?.(null);
    setAsking({ kind: "point" });
    return new Promise<Point | null>((resolve) => {
      waiting.current = resolve as (answer: Point | Zone | null) => void;
    });
  }, []);

  const placeRegion = useCallback((from: Point | null, metres: number) => {
    waiting.current?.(null);
    setAsking({ kind: "zone", from, metres });
    return new Promise<Zone | null>((resolve) => {
      waiting.current = resolve as (answer: Point | Zone | null) => void;
    });
  }, []);

  const settle = useCallback((answer: Point | Zone | null) => {
    setAsking(null);
    const told = waiting.current;
    waiting.current = null;
    told?.(answer);
  }, []);

  const value = useMemo(
    () => ({
      aiming: asking !== null,
      asking,
      place,
      placeRegion,
      settle,
      looking,
    }),
    [asking, place, placeRegion, settle],
  );

  return (
    <PlacementContext.Provider value={value}>
      {children}
    </PlacementContext.Provider>
  );
}

export function usePlacement(): PlacementContextValue {
  const value = useContext(PlacementContext);
  if (!value) {
    throw new Error("usePlacement must be used inside a PlacementProvider");
  }
  return value;
}
