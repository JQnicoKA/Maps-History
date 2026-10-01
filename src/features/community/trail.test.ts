import { describe, expect, it } from "vitest";

import { KEPT, windowed } from "./trail";

describe("windowed", () => {
  it("draws nothing for a trail nobody has started", () => {
    expect(windowed([])).toEqual([]);
  });

  it("draws a short trail whole, at its own depths", () => {
    expect(windowed(["a", "b"])).toEqual([
      { step: "a", depth: 0 },
      { step: "b", depth: 1 },
    ]);
  });

  it("keeps the last three of a longer one", () => {
    expect(windowed(["a", "b", "c", "d", "e"])).toEqual([
      { step: "c", depth: 2 },
      { step: "d", depth: 3 },
      { step: "e", depth: 4 },
    ]);
  });

  /**
   * The claim the whole window rests on: a step that is still in view after
   * a move is at the same depth as before it, so the card keyed on that
   * depth is the same instance — it keeps what it read and where it was
   * scrolled. The arriving card is always one of those, which is what makes
   * "Retour" free.
   */
  it("holds a step's depth steady while it stays in view", () => {
    const deep = ["a", "b", "c", "d", "e"];
    const back = deep.slice(0, -1);

    const before = new Map(windowed(deep).map((at) => [at.step, at.depth]));
    const after = new Map(windowed(back).map((at) => [at.step, at.depth]));

    for (const [step, depth] of after) {
      if (before.has(step)) expect(before.get(step)).toBe(depth);
    }
    // And the one being arrived at really is still mounted rather than
    // merely at the same number.
    expect(after.has("d")).toBe(true);
  });

  it("holds it steady on the way down too", () => {
    const here = ["a", "b", "c", "d"];
    const deeper = [...here, "e"];

    const before = new Map(windowed(here).map((at) => [at.step, at.depth]));
    const after = new Map(windowed(deeper).map((at) => [at.step, at.depth]));

    for (const [step, depth] of after) {
      if (before.has(step)) expect(before.get(step)).toBe(depth);
    }
    // The step that fell out of the window is the oldest, never a recent one.
    expect(after.has("b")).toBe(false);
    expect(after.has("c")).toBe(true);
  });

  it("never draws more than it keeps", () => {
    const long = Array.from({ length: 40 }, (_, at) => `step-${at}`);
    for (let length = 0; length <= long.length; length += 1) {
      expect(windowed(long.slice(0, length)).length).toBeLessThanOrEqual(KEPT);
    }
  });

  it("always ends on the step being read", () => {
    const long = Array.from({ length: 12 }, (_, at) => `step-${at}`);
    for (let length = 1; length <= long.length; length += 1) {
      const trail = long.slice(0, length);
      const drawn = windowed(trail);
      expect(drawn[drawn.length - 1]).toEqual({
        step: trail[trail.length - 1],
        depth: trail.length - 1,
      });
    }
  });
});
