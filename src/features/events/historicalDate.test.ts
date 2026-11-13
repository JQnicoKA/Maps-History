import { describe, expect, it } from "vitest";

import {
  ABOUT,
  formatDateYear,
  formatEventPeriod,
  formatHistoricalDate,
  formatYear,
  toSortKey,
  typedYear,
  yearOf,
} from "./historicalDate";
import type { EventSummary } from "./types";

describe("écrire une date", () => {
  it("écrit une année seule", () => {
    expect(formatHistoricalDate({ year: 1453 })).toBe("1453");
  });

  it("écrit un mois et un jour en français", () => {
    expect(formatHistoricalDate({ year: 1789, month: 7 })).toBe("juillet 1789");
    expect(formatHistoricalDate({ year: 1789, month: 7, day: 14 })).toBe("14 juillet 1789");
  });

  it("dit les années avant Jésus-Christ", () => {
    expect(formatYear(-44)).toBe("44 av. J.-C.");
    expect(formatHistoricalDate({ year: -44, month: 3, day: 15 })).toBe("15 mars 44 av. J.-C.");
  });

  it("porte la vague de l'incertitude partout", () => {
    expect(formatHistoricalDate({ year: 1066, approximate: true })).toBe(`${ABOUT}1066`);
    expect(formatHistoricalDate({ year: 1066, month: 9, approximate: true })).toBe(
      `${ABOUT}septembre 1066`,
    );
    expect(formatDateYear({ year: 1066, month: 9, day: 25, approximate: true })).toBe(
      `${ABOUT}1066`,
    );
  });

  it("n'en met pas quand la date est sûre", () => {
    expect(formatHistoricalDate({ year: 1066, approximate: false })).toBe("1066");
  });
});

describe("écrire une période", () => {
  const event = (over: Partial<EventSummary>): EventSummary => ({
    id: "e",
    createdAt: "2024-01-01T00:00:00Z",
    title: "t",
    type: "other",
    start: { year: 1337 },
    end: null,
    longitude: 0,
    latitude: 0,
    folders: [],
    importance: "medium",
    characters: [],
    cover: null,
    shared: true,
    origin: null,
    ...over,
  });

  it("écrit un instant tel quel", () => {
    expect(formatEventPeriod(event({}))).toBe("1337");
  });

  it("relie les deux bouts d'une guerre", () => {
    expect(formatEventPeriod(event({ end: { year: 1453 } }))).toBe("1337 – 1453");
  });
});

describe("ordonner des dates", () => {
  const key = toSortKey;

  it("place une année nue avant ses mois", () => {
    expect(key({ year: 1453 })).toBeLessThan(key({ year: 1453, month: 5 }));
  });

  it("ordonne les mois puis les jours", () => {
    expect(key({ year: 1453, month: 5 })).toBeLessThan(key({ year: 1453, month: 6 }));
    expect(key({ year: 1453, month: 5, day: 1 })).toBeLessThan(
      key({ year: 1453, month: 5, day: 29 }),
    );
  });

  it("ne déborde jamais sur l'année suivante", () => {
    expect(key({ year: 1453, month: 12, day: 31 })).toBeLessThan(key({ year: 1454 }));
  });

  it("ordonne aussi avant Jésus-Christ", () => {
    expect(key({ year: -509 })).toBeLessThan(key({ year: -44 }));
    expect(key({ year: -44 })).toBeLessThan(key({ year: 1 }));
  });

  it("ignore l'incertitude, qui ne déplace pas une date", () => {
    expect(key({ year: 1066, approximate: true })).toBe(key({ year: 1066 }));
  });
});

describe("relire l'année sur l'axe", () => {
  it("garde l'année d'une date de fin d'année", () => {
    /* La faute d'autrefois : le 23 décembre 487 s'affichait en 488. */
    expect(yearOf(toSortKey({ year: 487, month: 12, day: 23 }))).toBe(487);
    expect(yearOf(toSortKey({ year: 1453, month: 12, day: 31 }))).toBe(1453);
  });

  it("garde l'année avant Jésus-Christ", () => {
    expect(yearOf(toSortKey({ year: -50, month: 12, day: 31 }))).toBe(-50);
    expect(yearOf(toSortKey({ year: -50 }))).toBe(-50);
  });

  it("ne bouge pas une année pleine", () => {
    expect(yearOf(487)).toBe(487);
    expect(yearOf(-3000)).toBe(-3000);
  });
});

describe("typedYear", () => {
  it("ne garde que les chiffres", () => {
    expect(typedYear("12a0b")).toBe("120");
    expect(typedYear("abc")).toBe("");
    expect(typedYear("1 000")).toBe("1000");
  });

  it("garde un moins en tête, et seulement là", () => {
    expect(typedYear("-500")).toBe("-500");
    expect(typedYear("−500")).toBe("-500");
    expect(typedYear("-")).toBe("-");
    expect(typedYear("5-00")).toBe("500");
  });

  it("s'arrête à quatre chiffres", () => {
    expect(typedYear("123456")).toBe("1234");
  });
});
