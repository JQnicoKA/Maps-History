import { describe, expect, it } from "vitest";

import {
  canvasSize,
  columnAt,
  columnX,
  connectors,
  FACE,
  FACE_AXIS,
  frame,
  generationCount,
  NODE,
  PADDING,
  place,
  span,
  STROKE,
} from "./layout";
import type { Importance, Tree, TreeLink, TreeMember } from "../events/types";

const at = (
  id: string,
  generation: number,
  position: number,
  importance: Importance = "medium",
): TreeMember => ({
  id,
  characterId: `c${id}`,
  generation,
  position,
  importance,
  note: null,
});

const tree = (members: TreeMember[], links: TreeLink[]): Tree => ({
  id: "t",
  name: "T",
  note: null,
  members,
  links,
});

const drawn = (subject: Tree) => {
  const placed = place(subject);
  return {
    placed,
    at: (id: string) => placed.find((node) => node.member.id === id)!,
    segments: connectors(subject, placed),
  };
};

describe("le trait d'un couple", () => {
  const subject = tree(
    [at("f", 0, 0, "high"), at("m", 0, 1, "low")],
    [{ kind: "couple", from: "f", to: "m" }],
  );

  it("est unique", () => {
    expect(drawn(subject).segments).toHaveLength(1);
  });

  it("court d'un visage à l'autre, sur leur axe", () => {
    const { at: node, segments } = drawn(subject);
    const [bar] = segments;
    expect(bar!.top + STROKE / 2).toBeCloseTo(node("f").y + FACE_AXIS, 9);
    expect(bar!.left).toBeCloseTo(node("f").x + NODE.width / 2 + FACE / 2, 9);
    expect(bar!.left + bar!.width).toBeCloseTo(node("m").x + NODE.width / 2 - FACE / 2, 9);
  });

  it("a la même longueur quelles que soient les importances", () => {
    const pesants = tree(
      [at("f", 0, 0, "high"), at("m", 0, 1, "high")],
      [{ kind: "couple", from: "f", to: "m" }],
    );
    // Les visages ne changent plus de taille : le trait qui les joint non plus.
    expect(drawn(pesants).segments[0]!.width).toBeCloseTo(
      drawn(subject).segments[0]!.width,
      9,
    );
  });

  it("n'est pas tracé entre deux générations", () => {
    const crooked = tree(
      [at("f", 0, 0), at("k", 1, 0)],
      [{ kind: "couple", from: "f", to: "k" }],
    );
    expect(drawn(crooked).segments).toHaveLength(0);
  });
});

describe("le trait d'une filiation", () => {
  it("part du pied de la boîte quand le parent est seul", () => {
    const subject = tree(
      [at("f", 0, 0), at("a", 1, 0)],
      [{ kind: "descent", from: "f", to: "a" }],
    );
    const { at: node, segments } = drawn(subject);
    expect(segments).toHaveLength(3);
    expect(
      segments.some(
        (one) => one.width === STROKE && Math.abs(one.top - (node("f").y + NODE.height)) < 1e-9,
      ),
    ).toBe(true);
  });

  it("part du milieu de la barre quand les deux parents sont mariés", () => {
    const subject = tree(
      [at("f", 0, 0), at("m", 0, 1), at("a", 1, 0), at("b", 1, 1)],
      [
        { kind: "couple", from: "f", to: "m" },
        { kind: "descent", from: "f", to: "a" },
        { kind: "descent", from: "m", to: "a" },
        { kind: "descent", from: "f", to: "b" },
        { kind: "descent", from: "m", to: "b" },
      ],
    );
    const { at: node, segments } = drawn(subject);

    // Un trait de couple, et deux coudes — pas quatre.
    expect(segments).toHaveLength(1 + 2 * 3);

    const bar = segments.find((one) => one.height === STROKE && one.top < node("f").y + NODE.height)!;
    const middle = bar.left + bar.width / 2;
    const drops = segments.filter(
      (one) => one.width === STROKE && Math.abs(one.left + STROKE / 2 - middle) < 1e-9,
    );
    expect(drops).toHaveLength(2);
    expect(drops.every((one) => Math.abs(one.top - (node("f").y + FACE_AXIS)) < 1e-9)).toBe(true);
  });

  it("garde son propre coude quand les parents ne sont pas mariés", () => {
    const subject = tree(
      [at("f", 0, 0), at("m", 0, 1), at("a", 1, 0)],
      [
        { kind: "descent", from: "f", to: "a" },
        { kind: "descent", from: "m", to: "a" },
      ],
    );
    expect(drawn(subject).segments).toHaveLength(6);
  });

  it("fait partager un tronc aux frères et sœurs", () => {
    const subject = tree(
      [at("f", 0, 0), at("a", 1, 0), at("b", 1, 1)],
      [
        { kind: "descent", from: "f", to: "a" },
        { kind: "descent", from: "f", to: "b" },
      ],
    );
    const { at: node, segments } = drawn(subject);
    const trunks = segments.filter(
      (one) => one.width === STROKE && Math.abs(one.top - (node("f").y + NODE.height)) < 1e-9,
    );
    expect(trunks).toHaveLength(2);
    expect(trunks[0]!.left).toBe(trunks[1]!.left);
  });
});

describe("ce que le dessin ne fait jamais", () => {
  it("ne produit que des rectangles utilisables comme style", () => {
    const subject = tree(
      [at("f", 0, 0), at("m", 0, 1), at("a", 1, 0)],
      [
        { kind: "couple", from: "f", to: "m" },
        { kind: "descent", from: "f", to: "a" },
      ],
    );
    for (const segment of drawn(subject).segments) {
      expect(Object.keys(segment).sort()).toEqual(["height", "left", "top", "width"]);
      expect(segment.width).toBeGreaterThanOrEqual(0);
      expect(segment.height).toBeGreaterThanOrEqual(0);
    }
  });

  it("ignore un lien vers quelqu'un qui n'est plus là", () => {
    const subject = tree(
      [at("f", 0, 0)],
      [
        { kind: "couple", from: "f", to: "zz" },
        { kind: "descent", from: "zz", to: "f" },
      ],
    );
    expect(drawn(subject).segments).toHaveLength(0);
  });
});

describe("de la colonne au point, et retour", () => {
  const across = { from: -2, to: 4 };

  it("retrouve la colonne d'où vient le point", () => {
    for (const column of [-2, -1, 0, 1, 4]) {
      expect(columnAt(columnX(column, across), across)).toBe(column);
    }
  });

  it("arrondit vers la colonne la plus proche", () => {
    const pas = NODE.width + 16;
    const zero = columnX(0, across);
    expect(columnAt(zero + pas * 0.4, across)).toBe(0);
    expect(columnAt(zero + pas * 0.6, across)).toBe(1);
  });
});

describe("la toile", () => {
  const subject = tree([at("f", 0, 0), at("a", 1, 0), at("b", 1, 1)], []);

  it("garde une rangée vide au-dessus et au-dessous", () => {
    expect(frame(subject)).toEqual({ from: -1, to: 2 });
  });

  it("garde une colonne libre à droite, pour le +", () => {
    expect(span(subject)).toEqual({ from: 0, to: 2 });
  });

  it("recale les colonnes négatives au moment de dessiner", () => {
    const ecarte = tree([at("gauche", 0, -3), at("droite", 0, 1)], []);
    const [premier] = place(ecarte);
    // La colonne −3 se dessine au bord, pas hors de la toile.
    expect(premier!.x).toBe(PADDING);
    expect(canvasSize(ecarte).width).toBeGreaterThan(4 * NODE.width);
  });

  it("compte la largeur sur la colonne la plus à droite, pas sur l'effectif", () => {
    const clairseme = tree([at("a", 0, 0), at("b", 0, 9)], []);
    const serre = tree([at("a", 0, 0), at("b", 0, 1)], []);
    expect(canvasSize(clairseme).width).toBeGreaterThan(canvasSize(serre).width);
  });

  it("est assez grande pour la rangée la plus large et sa case libre", () => {
    const size = canvasSize(subject);
    expect(size.width).toBeGreaterThanOrEqual(3 * NODE.width);
    expect(size.height).toBeGreaterThan(4 * NODE.height);
  });

  it("compte les générations peuplées, pas les rangées dessinées", () => {
    expect(generationCount(subject)).toBe(2);
  });
});
