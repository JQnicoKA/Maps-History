import { describe, expect, it } from "vitest";

import { bounds, widthsFor } from "./period";

describe("les largeurs qu'on ose proposer", () => {
  it("offre la semaine à qui a nommé un jour", () => {
    expect(widthsFor({ year: 1789, month: 7, day: 14 }).map((w) => w.label)).toEqual(
      ["± 1 semaine", "± 1 mois", "± 1 an"],
    );
  });

  it("commence au mois à qui n'a nommé qu'un mois", () => {
    expect(widthsFor({ year: 1789, month: 7 }).map((w) => w.label)).toEqual([
      "± 1 mois",
      "± 1 an",
      "± 10 ans",
    ]);
  });

  /** On ne propose pas une semaine à qui n'a jamais prétendu la connaître. */
  it("commence à la décennie à qui n'a nommé qu'une année", () => {
    expect(widthsFor({ year: 1789 }).map((w) => w.label)).toEqual([
      "± 10 ans",
      "± 50 ans",
      "± 100 ans",
    ]);
  });
});

describe("les bornes qu'une date et une largeur font", () => {
  it("encadre l'année sur l'axe continu", () => {
    expect(bounds({ year: 1500 }, 10)).toEqual({ since: 1490, until: 1510 });
  });

  it("encadre un jour à la semaine près", () => {
    const { since, until } = bounds({ year: 476, month: 9, day: 4 }, 7 / 372);
    // 476 + 8/12 + 3/372 = 476,6747…
    expect(since).toBeCloseTo(476.6559, 4);
    expect(until).toBeCloseTo(476.6935, 4);
  });

  it("ne borne rien quand la largeur est toute l'histoire", () => {
    expect(bounds({ year: 1500 }, null)).toEqual({ since: null, until: null });
  });

  it("ne borne rien sans date", () => {
    expect(bounds(null, 10)).toEqual({ since: null, until: null });
  });
});
