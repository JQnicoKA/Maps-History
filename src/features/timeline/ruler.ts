/**
 * The arithmetic behind the frieze: where the graduations fall, and how the
 * frieze opens up under the finger.
 *
 * Kept out of the component because both are pure and both are fiddly — the
 * kind of thing worth reading on its own.
 */

/**
 * The ladder a ruler is allowed to climb. Anything else — a tick every seven
 * years, a tick every forty — reads as an accident rather than a scale.
 */
const STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] as const;

/** Below this, graduations stop being separate marks and become a grey band. */
const MIN_TICK_PX = 6;

/** Each step and the one that carries the heavy stroke above it. */
const MAJOR: Record<number, number> = {
  1: 5,
  2: 10,
  5: 25,
  10: 50,
  25: 100,
  50: 250,
  100: 500,
  250: 1000,
  500: 2500,
  1000: 5000,
  2500: 10000,
  5000: 25000,
};

function stepFor(pxPerYear: number): number {
  for (const step of STEPS) {
    if (step * pxPerYear >= MIN_TICK_PX) return step;
  }
  return STEPS[STEPS.length - 1]!;
}

export type Scale = {
  /** Years between light strokes. Finer while the frieze is magnified. */
  minor: number;
  /** Years between heavy strokes. Fixed, so the landmarks never move. */
  major: number;
};

/**
 * The heavy strokes are chosen at the resting scale and stay there: they are
 * what tells you *where* you are, and a landmark that moves is no landmark.
 * Only the light strokes get finer as the frieze opens — which is what makes
 * the magnification legible instead of merely larger.
 */
export function scaleFor(pxPerYear: number, magnification: number): Scale {
  const resting = stepFor(pxPerYear);
  return {
    minor: stepFor(pxPerYear * magnification),
    major: MAJOR[resting] ?? resting * 5,
  };
}

/** Multiples of `step` inside [from, to]. */
export function ticksBetween(from: number, to: number, step: number): number[] {
  const first = Math.ceil(from / step) * step;
  const out: number[] = [];
  for (let year = first; year <= to; year += step) out.push(year);
  return out;
}

/**
 * Spreads the frieze apart around the finger and squeezes it back together
 * further off — a lens applied to the frieze itself rather than a panel
 * floating above it.
 *
 * The two ends stay pinned where they were, so the whole span is still on
 * screen and still reachable in one drag; only the spacing changes. Each side
 * of the focus gets its own Möbius curve, `m·t / (1 + (m−1)·t)`, which is the
 * one that leaves both ends fixed, multiplies the scale by exactly `m` at the
 * focus, and never doubles back.
 */
export function magnify(
  at: number,
  focus: number,
  width: number,
  magnification: number,
): number {
  if (magnification <= 1) return at;

  const ahead = at >= focus;
  const reach = ahead ? width - focus : focus;
  if (reach <= 0) return at;

  const t = Math.abs(at - focus) / reach;
  const pulled = (magnification * t) / (1 + (magnification - 1) * t);
  return focus + (ahead ? 1 : -1) * reach * pulled;
}

/** "1453", "-330" as "330 av." — a ruler has no room for "av. J.-C.". */
export function tickLabel(year: number): string {
  return year < 0 ? `${-year} av.` : String(year);
}
