import { describe, expect, it } from "vitest";

import { NO_SIFT, kept, narrowing, type Sift, type Siftable } from "./sift";

const one = (
  id: string,
  folders: string[] = [],
  importance: Siftable["importance"] = "medium",
): Siftable & { id: string } => ({ id, folders, importance });

const sift = (over: Partial<Sift> = {}): Sift => ({ ...NO_SIFT, ...over });

describe("narrowing", () => {
  it("ne compte rien quand rien n'est demandé", () => {
    expect(narrowing(NO_SIFT)).toBe(0);
  });

  it("compte les classeurs pour un, quel que soit leur nombre", () => {
    expect(narrowing(sift({ folders: ["A"] }))).toBe(1);
    expect(narrowing(sift({ folders: ["A", "B", "C"] }))).toBe(1);
  });

  it("compte l'importance pour un", () => {
    expect(narrowing(sift({ importance: "high" }))).toBe(1);
  });

  it("compte les deux questions", () => {
    expect(narrowing(sift({ folders: ["A"], importance: "low" }))).toBe(2);
  });
});

describe("kept", () => {
  const all = [
    one("a", ["Mérovingiens"], "high"),
    one("b", ["Capétiens"], "medium"),
    one("c", ["Mérovingiens", "Capétiens"], "low"),
    one("d", [], "high"),
  ];

  it("rend tout quand rien n'est demandé", () => {
    expect(kept(all, NO_SIFT).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("rend une copie, pour que trier ensuite ne touche à rien", () => {
    const same = kept(all, NO_SIFT);
    expect(same).not.toBe(all);
    expect(same).toEqual(all);
  });

  it("retient ce qui est dans l'un des classeurs demandés", () => {
    expect(
      kept(all, sift({ folders: ["Mérovingiens"] })).map((x) => x.id),
    ).toEqual(["a", "c"]);
  });

  it("lit plusieurs classeurs en « l'un de » et non en « tous »", () => {
    // Qui demande les deux règnes veut les deux règnes, et non les quelques
    // éléments rangés dans les deux à la fois.
    expect(
      kept(all, sift({ folders: ["Mérovingiens", "Capétiens"] })).map(
        (x) => x.id,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("écarte ce qui n'est rangé nulle part dès qu'un classeur est demandé", () => {
    expect(
      kept(all, sift({ folders: ["Mérovingiens"] })).map((x) => x.id),
    ).not.toContain("d");
  });

  it("retient un seul cran d'importance", () => {
    expect(kept(all, sift({ importance: "high" })).map((x) => x.id)).toEqual([
      "a",
      "d",
    ]);
  });

  it("croise les deux questions", () => {
    expect(
      kept(all, sift({ folders: ["Mérovingiens"], importance: "high" })).map(
        (x) => x.id,
      ),
    ).toEqual(["a"]);
  });

  it("peut ne rien rendre", () => {
    expect(
      kept(all, sift({ folders: ["Carolingiens"] })),
    ).toEqual([]);
  });

  it("garde l'ordre reçu", () => {
    // La page trie après avoir tamisé : si le tamis réordonnait, le tri
    // chronologique s'appliquerait à une liste déjà remuée pour rien.
    expect(kept(all, sift({ importance: "high" })).map((x) => x.id)).toEqual([
      "a",
      "d",
    ]);
  });
});
