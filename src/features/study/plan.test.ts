import { describe, expect, it } from "vitest";

import {
  MIN_SUBJECTS,
  NEAR,
  OPTIONS,
  buildStudy,
  chooseOptions,
  seeded,
  shuffle,
  tally,
  type Subject,
} from "./plan";

/** Une collection de n sujets, espacés d'un an, nommés par leur rang. */
function collection(n: number, from = 1000): Subject[] {
  return Array.from({ length: n }, (_, at) => ({
    id: `s${at}`,
    label: `Sujet ${at}`,
    at: from + at,
  }));
}

describe("shuffle", () => {
  it("rend une permutation, sans toucher à la liste reçue", () => {
    const given = collection(8);
    const mixed = shuffle(given, seeded(1));

    expect(mixed).toHaveLength(8);
    expect(mixed.map((one) => one.id).sort()).toEqual(
      given.map((one) => one.id).sort(),
    );
    expect(given.map((one) => one.id)).toEqual(collection(8).map((o) => o.id));
  });

  it("rejoue le même mélange à graine égale", () => {
    const given = collection(20);
    expect(shuffle(given, seeded(42))).toEqual(shuffle(given, seeded(42)));
  });
});

describe("chooseOptions", () => {
  it("offre quatre réponses dont la bonne", () => {
    const all = collection(30);
    const subject = all[10] as Subject;

    const options = chooseOptions(subject, all, seeded(7));

    expect(options).toHaveLength(OPTIONS);
    expect(options.filter((one) => one.id === subject.id)).toHaveLength(1);
  });

  it("ne répète aucun nom", () => {
    const all = collection(30);
    const options = chooseOptions(all[3] as Subject, all, seeded(9));
    expect(new Set(options.map((one) => one.label)).size).toBe(options.length);
  });

  it("écarte les homonymes, qui feraient une question sans réponse", () => {
    const subject: Subject = { id: "a", label: "Clovis", at: 500 };
    const all: Subject[] = [
      subject,
      { id: "b", label: "Clovis", at: 501 },
      { id: "c", label: "Childéric", at: 502 },
      { id: "d", label: "Clotaire", at: 503 },
      { id: "e", label: "Dagobert", at: 504 },
    ];

    const options = chooseOptions(subject, all, seeded(3));
    expect(options.filter((one) => one.label === "Clovis")).toHaveLength(1);
  });

  it("prend ses leurres chez les voisins dans le temps", () => {
    // Douze voisins autour de l'an mil, et un intrus deux millénaires plus loin.
    const all: Subject[] = [
      ...collection(NEAR + 1, 1000),
      { id: "loin", label: "Très loin", at: 3000 },
    ];
    const subject = all[0] as Subject;

    // Sur beaucoup de tirages, l'intrus ne doit jamais sortir : il est
    // au-delà des douze plus proches.
    for (let seed = 0; seed < 50; seed += 1) {
      const options = chooseOptions(subject, all, seeded(seed));
      expect(options.map((one) => one.id)).not.toContain("loin");
    }
  });

  it("varie les leurres d'une question à l'autre", () => {
    const all = collection(30);
    const subject = all[15] as Subject;

    const drawn = new Set<string>();
    for (let seed = 0; seed < 20; seed += 1) {
      for (const option of chooseOptions(subject, all, seeded(seed))) {
        if (option.id !== subject.id) drawn.add(option.id);
      }
    }
    // Trois leurres par tirage, mais bien plus de trois leurres possibles.
    expect(drawn.size).toBeGreaterThan(OPTIONS);
  });

  it("se contente de ce qu'il y a quand la collection est maigre", () => {
    const all = collection(3);
    const options = chooseOptions(all[0] as Subject, all, seeded(1));

    expect(options).toHaveLength(3);
    expect(options.map((one) => one.id)).toContain("s0");
  });

  it("offre une seule réponse pour un sujet seul au monde", () => {
    const only: Subject = { id: "x", label: "Seul", at: 1 };
    expect(chooseOptions(only, [only], seeded(1))).toEqual([only]);
  });
});

describe("buildStudy", () => {
  const all = collection(10);

  it("range les questions dans l'ordre du temps", () => {
    const pool = shuffle(all, seeded(5));
    const study = buildStudy({
      pool,
      everything: all,
      order: "chronological",
      rng: seeded(5),
    });

    expect(study.map((one) => one.subject.at)).toEqual(
      [...all].map((one) => one.at),
    );
  });

  it("interroge tout ce que le filtre retient, et rien d'autre", () => {
    const pool = all.slice(0, 4);
    const study = buildStudy({
      pool,
      everything: all,
      order: "random",
      rng: seeded(2),
    });

    expect(study).toHaveLength(4);
    expect([...study.map((one) => one.subject.id)].sort()).toEqual([
      "s0",
      "s1",
      "s2",
      "s3",
    ]);
  });

  it("tire ses leurres hors du filtre, qui sinon les désignerait", () => {
    // Quatre sujets étudiés sur dix : si les leurres venaient du filtre, les
    // propositions ne porteraient jamais que ces quatre noms.
    const pool = all.slice(0, 4);
    const study = buildStudy({
      pool,
      everything: all,
      order: "random",
      rng: seeded(11),
    });

    const offered = new Set(
      study.flatMap((one) => one.options.map((option) => option.id)),
    );
    expect([...offered].some((id) => !["s0", "s1", "s2", "s3"].includes(id))).toBe(
      true,
    );
  });

  it("ne demande jamais le même sujet deux fois", () => {
    const study = buildStudy({
      pool: all,
      everything: all,
      order: "random",
      rng: seeded(8),
    });
    expect(new Set(study.map((one) => one.subject.id)).size).toBe(all.length);
  });
});

describe("tally", () => {
  const all = collection(5);
  const study = buildStudy({
    pool: all,
    everything: all,
    order: "chronological",
    rng: seeded(1),
  });

  it("compte juste", () => {
    const answers = new Map([
      ["s0", "s0"],
      ["s1", "s3"],
      ["s2", "s2"],
    ]);

    const score = tally(study, answers);
    expect(score).toEqual({
      right: 2,
      asked: 3,
      missed: [all[1]],
    });
  });

  it("compte sur ce qu'on a répondu, non sur ce qui était prévu", () => {
    // Partir à la deuxième question sur cinq donne un score sur une, et non
    // quatre fautes.
    const score = tally(study, new Map([["s0", "s0"]]));
    expect(score.asked).toBe(1);
    expect(score.missed).toEqual([]);
  });

  it("ne rend rien d'une étude sans réponse", () => {
    expect(tally(study, new Map())).toEqual({
      right: 0,
      asked: 0,
      missed: [],
    });
  });
});

describe("les seuils", () => {
  it("demande quatre sujets, qui est ce qu'une question consomme", () => {
    expect(MIN_SUBJECTS).toBe(OPTIONS);
  });
});
