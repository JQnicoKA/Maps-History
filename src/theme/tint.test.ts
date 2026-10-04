import { describe, expect, it } from "vitest";

import { palette } from "./palette";
import { contrastWithLabel, inWax } from "./tint";

/** A hue, at a saturation and lightness a photograph might plausibly hand us. */
const photographAt = (hue: number): string => {
  const c = 0.6 * (1 - Math.abs(2 * 0.4 - 1));
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = 0.4 - c / 2;
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  return (
    "#" +
    [r + m, g + m, b + m]
      .map((channel) =>
        Math.round(channel * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
};

describe("inWax", () => {
  it("gives the wax when there is no photograph", () => {
    expect(inWax(null)).toBe(palette.wax.toLowerCase());
    expect(inWax(undefined)).toBe(palette.wax.toLowerCase());
  });

  it("gives the wax when the photograph had no colour in it", () => {
    // A daguerreotype, a pencil drawing, a black-and-white scan: the Edge
    // Function stores null rather than inventing a hue.
    expect(inWax(null)).toBe(palette.wax.toLowerCase());
  });

  it("returns the wax itself to the wax, exactly", () => {
    // Not a coincidence worth losing: the wax's own hue solved against the
    // wax's own luminance is the wax's own lightness.
    expect(inWax(palette.wax)).toBe(palette.wax.toLowerCase());
  });

  it("ignores anything that is not a six-digit colour", () => {
    for (const rubbish of ["", "#fff", "red", "8c3a2b", "#8c3a2bff"]) {
      expect(inWax(rubbish)).toBe(palette.wax.toLowerCase());
    }
  });

  it("keeps the hue of the photograph", () => {
    // A blue portrait must give a blue card — that is the whole point. The
    // card's own blue channel has to dominate, as the photograph's did.
    const card = inWax(photographAt(240));
    const n = Number.parseInt(card.slice(1), 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it("separates hues a reader would call different colours", () => {
    const cards = [0, 120, 240].map((hue) => inWax(photographAt(hue)));
    expect(new Set(cards).size).toBe(3);
  });

  /**
   * The contract, asserted rather than trusted.
   *
   * With the lightness left at the wax's, an olive card falls to 2.8:1 against
   * the cream label and an indigo climbs to 9.1:1. Solving the lightness for
   * the wax's luminance and capping it there is what holds both ends.
   */
  it("never reads worse than the wax, at any hue", () => {
    const wax = contrastWithLabel(palette.wax);
    for (let hue = 0; hue < 360; hue += 1) {
      const ratio = contrastWithLabel(inWax(photographAt(hue)));
      // A tenth of a point of slack for the rounding to whole channels.
      expect(ratio).toBeGreaterThan(wax - 0.1);
    }
  });

  it("is never lighter than the wax, at any hue", () => {
    // What keeps a blue from turning vivid: the solved lightness is capped,
    // and going darker only ever widens the contrast above.
    for (let hue = 0; hue < 360; hue += 1) {
      const card = inWax(photographAt(hue));
      const n = Number.parseInt(card.slice(1), 16);
      const channels = [n >> 16, (n >> 8) & 255, n & 255];
      const lightness = (Math.max(...channels) + Math.min(...channels)) / 2;
      expect(lightness).toBeLessThanOrEqual(0.3588 * 255 + 1);
    }
  });

  it("does not care how the colour was capitalised", () => {
    expect(inWax("#8C3A2B")).toBe(inWax("#8c3a2b"));
  });

  /**
   * Measured, not imagined.
   *
   * These five are what the `tint` Edge Function actually returned for five
   * real portraits — four painted likenesses, which come back brown, and one
   * on a deep blue ground. They are here so that a change to the taming shows
   * up as a diff on real input rather than on a synthetic hue wheel, and so
   * that the spread stays visible: four browns a few degrees apart, and one
   * card that is plainly a different colour.
   */
  it("spreads real portraits without leaving the palette", () => {
    const measured: [string, string][] = [
      ["#482f22", "#7e4527"],
      ["#583f29", "#754a24"],
      ["#705d49", "#724b23"],
      ["#7d6e54", "#6a4f21"],
      ["#0e1159", "#2b2f8c"],
    ];
    for (const [dominant, card] of measured) {
      expect(inWax(dominant)).toBe(card);
    }
    // All five distinct, which is the whole reason for doing any of this.
    expect(new Set(measured.map(([one]) => inWax(one))).size).toBe(5);
  });
});
