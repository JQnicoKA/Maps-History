import { describe, expect, it } from "vitest";

import { headOf } from "./head";
import type { Character, TreeMember } from "../events/types";

const qui = (
  id: string,
  generation: number,
  position: number,
): TreeMember => ({
  kind: "person",
  id: `m-${id}`,
  characterId: id,
  generation,
  position,
  note: null,
});

const etiquette = (id: string, generation: number): TreeMember => ({
  kind: "label",
  id,
  generation,
  position: 0,
  text: "Une maison",
  width: 2,
});

const poids = (
  ...paires: [string, Character["importance"]][]
): Pick<Character, "id" | "importance">[] =>
  paires.map(([id, importance]) => ({ id, importance }));

describe("headOf", () => {
  it("prend le plus haut quand personne n'est majeur", () => {
    const tree = { members: [qui("b", 1, 0), qui("a", 0, 0)] };
    expect(headOf(tree, poids(["a", "low"], ["b", "medium"]))).toBe("a");
  });

  it("préfère le majeur de la plus haute génération qui en porte un", () => {
    const tree = { members: [qui("a", 0, 0), qui("b", 0, 1), qui("c", 1, 0)] };
    expect(
      headOf(tree, poids(["a", "low"], ["b", "high"], ["c", "high"])),
    ).toBe("b");
  });

  it("descend chercher un majeur si la première génération n'en a pas", () => {
    const tree = { members: [qui("a", 0, 0), qui("b", 1, 0)] };
    expect(headOf(tree, poids(["a", "medium"], ["b", "high"]))).toBe("b");
  });

  it("départage par la position à génération égale", () => {
    const tree = { members: [qui("droite", 0, 3), qui("gauche", 0, 1)] };
    expect(headOf(tree, poids(["droite", "low"], ["gauche", "low"]))).toBe(
      "gauche",
    );
  });

  it("ignore les étiquettes, qui ne sont pas des gens", () => {
    const tree = { members: [etiquette("e", 0), qui("a", 1, 0)] };
    expect(headOf(tree, poids(["a", "low"]))).toBe("a");
  });

  it("ne rend personne pour un arbre vide", () => {
    expect(headOf({ members: [] }, [])).toBeNull();
  });

  it("ne rend personne pour un arbre qui n'a que des étiquettes", () => {
    expect(headOf({ members: [etiquette("e", 0)] }, [])).toBeNull();
  });

  it("tient debout quand le personnage n'est pas dans la collection", () => {
    const tree = { members: [qui("inconnu", 0, 0)] };
    expect(headOf(tree, [])).toBe("inconnu");
  });
});
