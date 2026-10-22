import { describe, expect, it } from "vitest";

import {
  boxAround,
  cornersOf,
  frameBox,
  latitudeAt,
  lifted,
  mercatorY,
  worldPoints,
} from "./frame";

const SCREEN = { width: 390, height: 844 };

describe("mercatorY", () => {
  it("met l'équateur au milieu", () => {
    expect(mercatorY(0)).toBeCloseTo(0.5, 10);
  });

  it("croît vers le sud, comme les pixels d'un écran", () => {
    expect(mercatorY(45)).toBeLessThan(mercatorY(0));
    expect(mercatorY(-45)).toBeGreaterThan(mercatorY(0));
  });

  it("revient sur ses pas", () => {
    for (const latitude of [-80, -45, -1, 0, 1, 45, 60, 80]) {
      expect(latitudeAt(mercatorY(latitude))).toBeCloseTo(latitude, 9);
    }
  });

  it("écarte les parallèles à mesure qu'on monte", () => {
    // Dix degrés près de l'équateur occupent moins de planche que dix degrés
    // près du cercle polaire : c'est toute la distorsion de Mercator.
    const nearEquator = Math.abs(mercatorY(10) - mercatorY(0));
    const nearPole = Math.abs(mercatorY(70) - mercatorY(60));
    expect(nearPole).toBeGreaterThan(nearEquator);
  });
});

describe("worldPoints", () => {
  it("compte sur des tuiles de 512 points, non de 256", () => {
    // La leçon du pinceau : MapLibre pose son échelle sur 512.
    expect(worldPoints(0)).toBe(512);
    expect(worldPoints(1)).toBe(1024);
    expect(worldPoints(10)).toBe(512 * 1024);
  });
});

describe("lifted", () => {
  it("descend la caméra pour que le sujet monte", () => {
    const raised = lifted({ longitude: 2, latitude: 48 }, 6, 120);
    expect(raised.latitude).toBeLessThan(48);
  });

  it("ne bouge pas en longitude", () => {
    expect(lifted({ longitude: 2.35, latitude: 48 }, 6, 120).longitude).toBe(
      2.35,
    );
  });

  it("lève d'autant de points qu'on le demande, quelle que soit l'échelle", () => {
    // Le décalage est posé en points d'écran : à toute échelle, le sujet doit
    // se retrouver cent points plus haut, donc l'écart en degrés doit fondre
    // quand on se rapproche.
    for (const zoom of [3, 6, 9]) {
      const from = { longitude: 0, latitude: 0 };
      const to = lifted(from, zoom, 100);
      const moved =
        (mercatorY(to.latitude) - mercatorY(from.latitude)) * worldPoints(zoom);
      expect(moved).toBeCloseTo(100, 6);
    }
  });

  it("ne lève rien quand on ne demande rien", () => {
    const point = { longitude: 2, latitude: 48 };
    expect(lifted(point, 6, 0).latitude).toBeCloseTo(48, 10);
  });

  it("ne sort pas du monde que Mercator sait dessiner", () => {
    const polar = lifted({ longitude: 0, latitude: -84 }, 2, 4000);
    expect(polar.latitude).toBeGreaterThanOrEqual(-85.06);
    expect(Number.isFinite(polar.latitude)).toBe(true);
  });
});

describe("frameBox", () => {
  const france = { west: -5, south: 42, east: 8, north: 51 };

  it("cadre une forme à une échelle où elle tient", () => {
    const { zoom } = frameBox(france, SCREEN);

    // À cette échelle, les treize degrés de large doivent occuper environ
    // sept dixièmes des 390 points de l'écran.
    const across = (13 / 360) * worldPoints(zoom);
    expect(across).toBeLessThanOrEqual(SCREEN.width * 0.7 + 0.001);
    expect(across).toBeGreaterThan(SCREEN.width * 0.3);
  });

  it("recule devant la dimension la plus exigeante", () => {
    // Une bande très haute et très étroite doit être cadrée par sa hauteur.
    const tall = { west: 0, south: -60, east: 1, north: 60 };
    const { zoom } = frameBox(tall, SCREEN);

    const down =
      Math.abs(mercatorY(-60) - mercatorY(60)) * worldPoints(zoom);
    expect(down).toBeLessThanOrEqual(SCREEN.height * 0.7 + 0.001);
  });

  it("vise le milieu de ce qu'on voit, non la moyenne des latitudes", () => {
    // Entre 0 et 60 degrés, le milieu de la planche est à 35,3 et non à 30 :
    // Mercator écarte le nord, qui occupe donc plus d'écran que le sud, et le
    // milieu de ce qu'on voit remonte d'autant.
    const { center } = frameBox(
      { west: -1, south: 0, east: 1, north: 60 },
      SCREEN,
    );
    expect(center[1]).toBeCloseTo(35.264, 3);
  });

  it("lève le sujet quand on le lui demande", () => {
    const plain = frameBox(france, SCREEN);
    const raised = frameBox(france, SCREEN, { lift: 140 });

    expect(raised.zoom).toBeCloseTo(plain.zoom, 10);
    expect(raised.center[1]).toBeLessThan(plain.center[1]);
  });

  it("ne s'affole pas devant une forme sans étendue", () => {
    const dot = { west: 2, south: 48, east: 2, north: 48 };
    const { zoom, center } = frameBox(dot, SCREEN, { max: 9 });

    expect(zoom).toBe(9);
    expect(center[0]).toBe(2);
    // L'aller-retour par Mercator coûte un dernier chiffre.
    expect(center[1]).toBeCloseTo(48, 9);
  });

  it("reste entre les bornes qu'on lui donne", () => {
    const world = { west: -180, south: -80, east: 180, north: 80 };
    expect(frameBox(world, SCREEN, { min: 2 }).zoom).toBe(2);
    expect(frameBox({ west: 0, south: 0, east: 0.001, north: 0.001 }, SCREEN, {
      max: 7,
    }).zoom).toBe(7);
  });
});

describe("boxAround", () => {
  it("prend le tour d'un semis", () => {
    expect(
      boxAround([
        [2, 48],
        [-3, 51],
        [7, 43],
      ]),
    ).toEqual({ west: -3, south: 43, east: 7, north: 51 });
  });

  it("ne rend rien d'un semis vide", () => {
    expect(boxAround([])).toBeNull();
  });

  it("tient sur un point seul", () => {
    expect(boxAround([[2, 48]])).toEqual({
      west: 2,
      south: 48,
      east: 2,
      north: 48,
    });
  });
});

describe("cornersOf", () => {
  it("parcourt un polygone", () => {
    expect(
      cornersOf({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [2, 3],
            [0, 0],
          ],
        ],
      }),
    ).toEqual([
      [0, 0],
      [2, 0],
      [2, 3],
      [0, 0],
    ]);
  });

  it("parcourt les deux morceaux d'un multipolygone", () => {
    const corners = cornersOf({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [1, 1],
          ],
        ],
        [
          [
            [10, 10],
            [11, 11],
          ],
        ],
      ],
    });
    expect(boxAround(corners)).toEqual({
      west: 0,
      south: 0,
      east: 11,
      north: 11,
    });
  });

  it("ne rend rien d'une forme vide", () => {
    expect(cornersOf({ type: "Polygon", coordinates: [] })).toEqual([]);
  });
});
