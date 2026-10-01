import { describe, expect, it } from "vitest";

import { outline } from "./outline";

const square = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
  ],
};

describe("réduire une forme en bandes", () => {
  it("remplit un carré sur toute sa largeur, à chaque rangée", () => {
    const bands = outline(square, 6);
    expect(bands).toHaveLength(6);
    for (const band of bands) {
      expect(band.left).toBeCloseTo(0, 6);
      expect(band.width).toBeCloseTo(1, 6);
    }
  });

  it("compte les rangées depuis le haut, la latitude montant", () => {
    // Un triangle dont la pointe est en haut : la première bande est étroite.
    const triangle = {
      type: "Polygon",
      coordinates: [
        [
          [5, 10],
          [10, 0],
          [0, 0],
          [5, 10],
        ],
      ],
    };
    const bands = outline(triangle, 4);
    expect(bands[0]!.width).toBeLessThan(bands[3]!.width);
  });

  it("rend deux bandes par rangée pour deux morceaux séparés", () => {
    const pair = {
      type: "MultiPolygon",
      coordinates: [
        [[[0, 0], [2, 0], [2, 10], [0, 10], [0, 0]]],
        [[[8, 0], [10, 0], [10, 10], [8, 10], [8, 0]]],
      ],
    };
    const bands = outline(pair, 3);
    expect(bands).toHaveLength(6);
    // Le premier morceau à gauche, le second à droite, sur chaque rangée.
    expect(bands[0]!.left).toBeCloseTo(0, 6);
    expect(bands[1]!.left).toBeCloseTo(0.8, 6);
  });

  it("ne rend rien de ce qui n'a pas de surface", () => {
    expect(outline(null)).toEqual([]);
    expect(outline({ type: "Point", coordinates: [1, 2] })).toEqual([]);
    expect(
      outline({
        type: "Polygon",
        coordinates: [[[0, 0], [10, 0], [0, 0]]],
      }),
    ).toEqual([]);
  });

  it("garde tout dans le carré unité", () => {
    const wonky = {
      type: "Polygon",
      coordinates: [
        [[-70, -35], [-68, -30], [-60, -33], [-65, -40], [-70, -35]],
      ],
    };
    for (const band of outline(wonky, 12)) {
      expect(band.top).toBeGreaterThanOrEqual(0);
      expect(band.top).toBeLessThan(1);
      expect(band.left).toBeGreaterThanOrEqual(-1e-9);
      expect(band.left + band.width).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
