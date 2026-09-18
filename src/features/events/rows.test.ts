import { describe, expect, it } from "vitest";

import { blockOf, blocks, couple, erasure, lineBetween, slide, spouses, tidy, tied } from "./rows";
import type { Move, Tree, TreeLink, TreeMember } from "./types";

const at = (
  id: string,
  position: number,
  generation = 0,
): TreeMember => ({
  id,
  characterId: `c${id}`,
  generation,
  position,
  importance: "medium",
  note: null,
});

const tree = (members: TreeMember[], links: TreeLink[]): Tree => ({
  id: "t",
  name: "T",
  note: null,
  members,
  links,
});

const wed = (from: string, to: string): TreeLink => ({ kind: "couple", from, to });
const begat = (from: string, to: string): TreeLink => ({ kind: "descent", from, to });

/** The row read left to right, as initials — "13452" is easier to argue with. */
const row = (subject: Tree, moves: Move[] = [], generation = 0): string =>
  subject.members
    .filter((member) => member.generation === generation)
    .map((member) => {
      const move = moves.find((one) => one.id === member.id);
      return { id: member.id, position: move ? move.position : member.position };
    })
    .sort((a, b) => a.position - b.position)
    .map((member) => member.id)
    .join("");

describe("un couple se tient ensemble", () => {
  it("rassemble deux époux séparés par un tiers", () => {
    const subject = tree([at("A", 0), at("B", 1), at("C", 2)], [wed("A", "C")]);
    const moves = tidy(subject, 0);
    expect(row(subject, moves)).toBe("ACB");
    // Only what must move, moves: A keeps its place.
    expect(moves).toHaveLength(2);
  });

  it("ne bouge rien quand la ligne est déjà propre", () => {
    const subject = tree([at("A", 0), at("C", 1), at("B", 2)], [wed("A", "C")]);
    expect(tidy(subject, 0)).toEqual([]);
  });

  it("compte un ménage comme un seul bloc", () => {
    const subject = tree([at("A", 0), at("B", 1), at("C", 2)], [wed("A", "B")]);
    expect(blocks(subject, 0)).toHaveLength(2);
    expect(blockOf(subject, subject.members[0]!)).toBe(
      blockOf(subject, subject.members[1]!),
    );
  });

  it("suit le mariage de proche en proche", () => {
    const subject = tree(
      [at("A", 0), at("X", 1), at("B", 2), at("C", 3)],
      [wed("A", "B"), wed("A", "C")],
    );
    expect(couple(subject, "C")).toEqual(new Set(["A", "B", "C"]));
    expect(row(subject, tidy(subject, 0))).toBe("ABCX");
  });

  it("ignore un lien de couple entre deux générations", () => {
    const subject = tree(
      [at("A", 0), at("B", 1), at("K", 0, 1)],
      [begat("A", "K"), wed("A", "K")],
    );
    expect(blocks(subject, 0)).toHaveLength(2);
  });
});

describe("un pas à gauche ou à droite", () => {
  /** La ligne de l'énoncé : 1 2 [3 4 5], les trois derniers mariés. */
  const household = () =>
    tree(
      [at("1", 0), at("2", 1), at("3", 2), at("4", 3), at("5", 4)],
      [wed("3", "4"), wed("3", "5")],
    );
  const who = (subject: Tree, id: string) =>
    subject.members.find((member) => member.id === id)!;

  it("emporte tout le ménage quand on part de son bord", () => {
    const subject = household();
    expect(row(subject, slide(subject, who(subject, "3"), -1))).toBe("13452");
  });

  it("échange seulement deux places à l'intérieur du ménage", () => {
    const subject = household();
    const moves = slide(subject, who(subject, "4"), -1);
    expect(row(subject, moves)).toBe("12435");
    expect(moves).toHaveLength(2);
  });

  it("échange aussi vers la droite sans déranger la ligne", () => {
    const subject = household();
    expect(row(subject, slide(subject, who(subject, "3"), 1))).toBe("12435");
  });

  it("ne sort personne de la ligne", () => {
    const subject = household();
    expect(slide(subject, who(subject, "1"), -1)).toEqual([]);
    expect(slide(subject, who(subject, "5"), 1)).toEqual([]);
  });

  it("fait enjamber un ménage par une personne seule", () => {
    const subject = tree([at("A", 0), at("B", 1), at("C", 2)], [wed("A", "B")]);
    const single = subject.members[2]!;
    expect(row(subject, slide(subject, single, -1))).toBe("CAB");
  });

  it("fait enjamber deux ménages entiers", () => {
    const subject = tree(
      [at("A", 0), at("B", 1), at("C", 2), at("D", 3)],
      [wed("A", "B"), wed("C", "D")],
    );
    // B is at the right edge of its household, so the whole of it travels.
    expect(row(subject, slide(subject, subject.members[1]!, 1))).toBe("CDAB");
  });
});

describe("effacer un lien", () => {
  /** Un couple, leur enfant, et un enfant que le père a eu ailleurs. */
  const family = () =>
    tree(
      [at("f", 0), at("m", 1), at("ours", 0, 1), at("his", 1, 1)],
      [
        wed("f", "m"),
        begat("f", "ours"),
        begat("m", "ours"),
        begat("f", "his"),
      ],
    );
  const said = (links: TreeLink[]) =>
    links.map((link) => `${link.kind === "couple" ? "=" : ">"}${link.from}${link.to}`).sort();

  it("emporte l'enfant du couple avec le mariage", () => {
    expect(said(erasure(family(), "f", "m"))).toEqual(["=fm", ">fours", ">mours"]);
  });

  it("épargne l'enfant que l'un seul revendique", () => {
    expect(erasure(family(), "f", "m").some((link) => link.to === "his")).toBe(false);
  });

  it("emporte la mère avec le père", () => {
    expect(said(erasure(family(), "f", "ours"))).toEqual([">fours", ">mours"]);
  });

  it("se lit pareil depuis l'enfant et depuis la mère", () => {
    const subject = family();
    expect(said(erasure(subject, "ours", "f"))).toEqual(said(erasure(subject, "f", "ours")));
    expect(said(erasure(subject, "m", "ours"))).toEqual(said(erasure(subject, "f", "ours")));
  });

  it("ne cascade pas sans mariage", () => {
    const subject = tree(
      [at("f", 0), at("m", 1), at("c", 0, 1)],
      [begat("f", "c"), begat("m", "c")],
    );
    expect(erasure(subject, "f", "c")).toHaveLength(1);
  });

  it("n'efface rien entre deux inconnus", () => {
    const subject = family();
    expect(erasure(subject, "m", "his")).toEqual([]);
    expect(erasure(subject, "f", "zz")).toEqual([]);
  });
});

describe("lire les liens", () => {
  const subject = () =>
    tree([at("a", 0), at("b", 1), at("c", 2)], [wed("a", "b")]);

  it("trouve un trait dans les deux sens", () => {
    expect(lineBetween(subject(), "b", "a")?.kind).toBe("couple");
    expect(lineBetween(subject(), "a", "b")?.kind).toBe("couple");
    expect(lineBetween(subject(), "a", "c")).toBeUndefined();
  });

  it("dit qui tient un trait et qui n'en tient aucun", () => {
    expect(tied(subject(), "a")).toBe(true);
    expect(tied(subject(), "c")).toBe(false);
  });

  it("nomme le conjoint, dans les deux sens", () => {
    expect(spouses(subject(), "a")).toEqual(["b"]);
    expect(spouses(subject(), "b")).toEqual(["a"]);
    expect(spouses(subject(), "c")).toEqual([]);
  });
});
