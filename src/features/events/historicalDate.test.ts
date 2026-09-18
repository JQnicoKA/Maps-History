import { describe, expect, it } from "vitest";

import {
  ABOUT,
  formatDateYear,
  formatEventPeriod,
  formatHistoricalDate,
  formatYear,
  toSortKey,
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
    title: "t",
    type: "other",
    start: { year: 1337 },
    end: null,
    longitude: 0,
    latitude: 0,
    folders: [],
    characters: [],
    cover: null,
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
