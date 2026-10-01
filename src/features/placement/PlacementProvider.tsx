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

/**
 * What the map is being asked for.
 *
 * Three questions, and the third is not a placement at all: a shape laid on
 * the plate to be looked at. It lives here because this is where a panel asks
 * the map for something and waits — the alternative was a second provider
 * doing the same dance for one kind of answer.
 */
export type Asked =
  | { kind: "point" }
  | { kind: "zone"; from: Point | null; metres: number }
  | ({
      kind: "shape";
      /** A GeoJSON geometry, as the database handed it over. */
      shape: unknown;
    } & Shown);

/**
 * How a shape laid on the plate presents itself.
 *
 * One argument rather than four trailing ones: three of them are strings,
 * and three strings in a row is a line nobody can read back without counting
 * — "was `said` before `take`, or after?".
 */
export type Shown = {
  name: string;
  /** The line under the name: its years, its extent. */
  said: string;
  /**
   * What the button that takes it says — "Copier le territoire".
   *
   * Handed over with the shape rather than decided here: this desk knows
   * about points and outlines, not about what kind of thing drew them.
   */
  take: string;
  /** False when it is the reader's own, or already taken. */
  takeable: boolean;
};

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
  /**
   * Lays a shape on the plate and waits for the reader to have looked.
   *
   * Resolves true if they asked to take it, false if they simply closed. A
   * territory is nothing but its outline, and no card can show that — only
   * the map can, against the coastlines it was painted over.
   */
  showShape: (shape: unknown, as: Shown) => Promise<boolean>;
  /** What the map is being asked for, while it is being asked. */
  asking: Asked | null;
  /** Answered by whoever owns the map. Not for the panels to call. */
  settle: (answer: Point | Zone | boolean | null) => void;
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
  const [asking, setAsking] = useState<Asked | null>(null);
  /**
   * Whoever is waiting for an answer, if anyone.
   *
   * Loosely typed on purpose: the three questions take three answers, and
   * each public method narrows its own at the boundary below. A union here
   * would have to be unwrapped again by every caller.
   */
  const waiting = useRef<((answer: Point | Zone | boolean | null) => void) | null>(
    null,
  );
  const looking = useRef<Point | null>(null);

  const place = useCallback(() => {
    // A second question while the first is unanswered should not leave the
    // first one waiting for ever: it is told nothing came of it.
    waiting.current?.(null);
    setAsking({ kind: "point" });
    return new Promise<Point | null>((resolve) => {
      // The three questions take three answers; each narrows its own here.
      waiting.current = (answer) =>
        resolve(answer === true || answer === false ? null : answer);
    });
  }, []);

  const placeRegion = useCallback((from: Point | null, metres: number) => {
    waiting.current?.(null);
    setAsking({ kind: "zone", from, metres });
    return new Promise<Zone | null>((resolve) => {
      waiting.current = (answer) =>
        resolve(
          answer !== null && typeof answer === "object" && "metres" in answer
            ? answer
            : null,
        );
    });
  }, []);

  const showShape = useCallback(
    (shape: unknown, as: Shown) => {
      waiting.current?.(null);
      setAsking({ kind: "shape", shape, ...as });
      return new Promise<boolean>((resolve) => {
        waiting.current = (answer) => resolve(answer === true);
      });
    },
    [],
  );

  const settle = useCallback((answer: Point | Zone | boolean | null) => {
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
      showShape,
      settle,
      looking,
    }),
    [asking, place, placeRegion, showShape, settle],
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
