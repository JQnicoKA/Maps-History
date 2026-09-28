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
  /** Answered by whoever owns the reticle. Not for the forms to call. */
  settle: (point: Point | null) => void;
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
  const [aiming, setAiming] = useState(false);
  /** Whoever is waiting for an answer, if anyone. */
  const asking = useRef<((point: Point | null) => void) | null>(null);

  const place = useCallback(() => {
    // A second question while the first is unanswered should not leave the
    // first one waiting for ever: it is told nothing came of it.
    asking.current?.(null);
    setAiming(true);
    return new Promise<Point | null>((resolve) => {
      asking.current = resolve;
    });
  }, []);

  const settle = useCallback((point: Point | null) => {
    setAiming(false);
    const answer = asking.current;
    asking.current = null;
    answer?.(point);
  }, []);

  const value = useMemo(
    () => ({ aiming, place, settle }),
    [aiming, place, settle],
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
