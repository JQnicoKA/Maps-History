import { describe, expect, it } from "vitest";

import { BRUSH_POINTS, brushMetres } from "./brush";

describe("le pinceau sur le terrain", () => {
  it("rétrécit quand on zoome", () => {
    expect(brushMetres(3, 0)).toBeGreaterThan(brushMetres(6, 0));
    // Trois niveaux de zoom, donc huit fois plus petit.
    expect(brushMetres(3, 0) / brushMetres(6, 0)).toBeCloseTo(8, 6);
  });

  it("rétrécit quand on monte vers le nord", () => {
    expect(brushMetres(5, 0)).toBeGreaterThan(brushMetres(5, 60));
    // cos 60° = ½.
    expect(brushMetres(5, 60) / brushMetres(5, 0)).toBeCloseTo(0.5, 6);
  });

  it("donne une largeur plausible à l'échelle d'un pays", () => {
    // Zoom 6 sur la France : un coup de pinceau doit faire quelques dizaines
    // de kilomètres de large, pas des centaines ni quelques mètres.
    const largeur = (brushMetres(6, 47) * 2) / 1000;
    expect(largeur).toBeGreaterThan(10);
    expect(largeur).toBeLessThan(120);
  });

  it("ne rend jamais un rayon nul, même au pôle", () => {
    expect(brushMetres(5, 90)).toBeGreaterThan(0);
    expect(Number.isFinite(brushMetres(22, 89.9))).toBe(true);
  });

  it("mesure bien un rayon, soit la moitié du trait", () => {
    // À zoom 0 sur l'équateur, un point vaut EQUATOR mètres.
    expect(brushMetres(0, 0)).toBeCloseTo((BRUSH_POINTS / 2) * 156543.03392, 3);
  });
});
