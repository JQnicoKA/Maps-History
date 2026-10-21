import { describe, expect, it } from "vitest";

import { rub } from "./rubber";
import type { Stroke } from "./drawn";

/**
 * Un trait horizontal régulier, à l'équateur.
 *
 * À cette latitude un degré de longitude vaut 111 319 mètres de Mercator, ce
 * qui donne des portées faciles à écrire.
 */
const DEGREE = (Math.PI * 6378137) / 180;

const line = (from: number, to: number, step = 0.1): Stroke => {
  const points: Stroke = [];
  for (let x = from; x <= to + 1e-9; x += step) {
    points.push([Number(x.toFixed(6)), 0]);
  }
  return points;
};

/** La longitude du premier et du dernier point de chaque morceau. */
const spans = (strokes: Stroke[]) =>
  strokes.map((one) => [one[0]![0], one[one.length - 1]![0]]);

describe("la gomme", () => {
  it("ne touche à rien quand elle passe loin", () => {
    const left = rub([line(0, 1)], [[5, 0]], DEGREE * 0.2);
    expect(left).toHaveLength(1);
    expect(left[0]).toHaveLength(11);
  });

  it("coupe un trait en deux quand elle le traverse au milieu", () => {
    const left = rub([line(0, 1)], [[0.5, 0]], DEGREE * 0.2);
    expect(left).toHaveLength(2);
    const [first, second] = spans(left);
    expect(first![0]).toBeCloseTo(0, 6);
    expect(first![1]).toBeCloseTo(0.3, 2);
    expect(second![0]).toBeCloseTo(0.7, 2);
    expect(second![1]).toBeCloseTo(1, 6);
  });

  it("raccourcit un trait quand elle frotte son bout", () => {
    const left = rub([line(0, 1)], [[1, 0]], DEGREE * 0.25);
    expect(left).toHaveLength(1);
    const [only] = spans(left);
    expect(only![0]).toBeCloseTo(0, 6);
    expect(only![1]).toBeCloseTo(0.75, 2);
  });

  it("fait disparaître un trait qu'elle recouvre entièrement", () => {
    const left = rub([line(0, 1)], [[0, 0], [1, 0]], DEGREE * 0.2);
    expect(left).toHaveLength(0);
  });

  it("coupe le bord à l'endroit touché, et non au point le plus proche", () => {
    // Les points sont espacés de 0,1° ; la coupe doit tomber à 0,37 et non
    // sur 0,3 ou 0,4. C'est l'interpolation qui le permet.
    const left = rub([line(0, 1)], [[0.5, 0]], DEGREE * 0.13);
    const [first] = spans(left);
    expect(first![1]).toBeCloseTo(0.37, 2);
  });

  it("passe sur plusieurs traits d'un coup", () => {
    const left = rub(
      [line(0, 1), line(0, 1).map(([x]) => [x!, 0.05] as [number, number])],
      [[0.5, 0], [0.5, 0.05]],
      DEGREE * 0.2,
    );
    expect(left).toHaveLength(4);
  });

  it("suit le chemin de la gomme, pas seulement ses bouts", () => {
    // Une gomme en L : son coude doit couper, bien qu'il soit loin des deux
    // extrémités du chemin.
    const left = rub(
      [line(0, 1)],
      [[0.5, 1], [0.5, 0], [1.5, 0]],
      DEGREE * 0.15,
    );
    expect(left.length).toBeGreaterThanOrEqual(1);
    const [first] = spans(left);
    expect(first![0]).toBeCloseTo(0, 6);
    expect(first![1]).toBeCloseTo(0.35, 2);
  });

  it("rend les traits inchangés quand la gomme est vide", () => {
    const one = [line(0, 1)];
    expect(rub(one, [], DEGREE)).toBe(one);
  });

  it("garde un point isolé, dont la base fait un disque", () => {
    const left = rub([[[0, 0], [1, 0]]], [[1, 0]], DEGREE * 0.5);
    expect(left).toHaveLength(1);
    expect(left[0]!.length).toBeGreaterThanOrEqual(1);
  });

  it("n'invente pas de latitude en chemin", () => {
    const left = rub([line(0, 1)], [[0.5, 0]], DEGREE * 0.2);
    for (const stroke of left) {
      for (const [, lat] of stroke) expect(lat).toBeCloseTo(0, 9);
    }
  });
});
