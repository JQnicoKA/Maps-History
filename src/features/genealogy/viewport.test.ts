import { describe, expect, it } from "vitest";

import { clampOffset, clampScale, fit, MARGIN, SCALE, zoomAround, type View } from "./viewport";

/** An iPhone, with the title bar above and the drawing bar below. */
const window = { width: 390, height: 844 };
const bars = { top: 100, bottom: 120 };

describe("où le dessin a le droit de se tenir", () => {
  it("centre un petit dessin, horizontalement et entre les barres", () => {
    const view: View = { scale: 1, offset: { x: -500, y: 9000 } };
    const offset = clampOffset(view, { width: 200, height: 300 }, window, bars);
    expect(offset.x).toBe((390 - 200) / 2);
    expect(offset.y).toBe(100 + (844 - 100 - 120 - 300) / 2);
  });

  it("ne laisse aucun vide aux bords d'un grand dessin", () => {
    const content = { width: 1200, height: 2000 };
    const pulled = clampOffset({ scale: 1, offset: { x: 50, y: 500 } }, content, window, bars);
    expect(pulled).toEqual({ x: 0, y: 100 });

    const pushed = clampOffset(
      { scale: 1, offset: { x: -5000, y: -5000 } },
      content,
      window,
      bars,
    );
    expect(pushed).toEqual({ x: 390 - 1200, y: 844 - 120 - 2000 });
  });

  it("recentre un grand dessin dès qu'il est réduit sous la fenêtre", () => {
    const content = { width: 1200, height: 2000 };
    const offset = clampOffset({ scale: 0.2, offset: { x: -500, y: -500 } }, content, window, bars);
    expect(offset.x).toBe((390 - 240) / 2);
  });
});

describe("pincer pour zoomer", () => {
  const before: View = { scale: 1, offset: { x: -100, y: -200 } };
  const focal = { x: 195, y: 400 };
  /** Le point du dessin qui se trouve sous les doigts avant le geste. */
  const held = {
    x: (focal.x - before.offset.x) / before.scale,
    y: (focal.y - before.offset.y) / before.scale,
  };

  it.each([1.7, 0.6, 1, 3.4, 0.05])("garde le point sous les doigts (×%s)", (factor) => {
    const after = zoomAround(before, focal, factor);
    expect(after.offset.x + held.x * after.scale).toBeCloseTo(focal.x, 9);
    expect(after.offset.y + held.y * after.scale).toBeCloseTo(focal.y, 9);
  });

  it("s'arrête aux butées sans laisser filer le dessin", () => {
    expect(zoomAround(before, focal, 99).scale).toBe(SCALE.max);
    expect(zoomAround(before, focal, 0.001).scale).toBe(SCALE.min);
    expect(clampScale(99)).toBe(SCALE.max);
    expect(clampScale(0)).toBe(SCALE.min);
  });
});

describe("cadrer à l'ouverture", () => {
  it("ajuste sur le côté le plus contraignant et centre", () => {
    const view = fit({ width: 900, height: 1000 }, window, bars);
    expect(view.scale).toBeCloseTo((390 - 2 * MARGIN) / 900, 9);
    expect(view.offset.x).toBeCloseTo((390 - 900 * view.scale) / 2, 9);
    expect(view.offset.y).toBeGreaterThanOrEqual(bars.top);
  });

  it("n'agrandit jamais un petit arbre", () => {
    expect(fit({ width: 200, height: 200 }, window, bars).scale).toBe(1);
  });

  it("ouvre au plancher un arbre trop large, calé sur son bord", () => {
    const view = fit({ width: 4000, height: 400 }, window, bars);
    expect(view.scale).toBe(SCALE.min);
    expect(view.offset.x).toBe(0);
  });

  it("ne divise pas par zéro sur un arbre vide", () => {
    const view = fit({ width: 0, height: 0 }, window, bars);
    expect(view.scale).toBe(1);
    expect(Number.isFinite(view.offset.y)).toBe(true);
  });
});
