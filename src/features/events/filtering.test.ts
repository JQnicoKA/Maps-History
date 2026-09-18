import { describe, expect, it } from "vitest";

import { effectiveImportance, matchesFilters } from "./filtering";
import type { EventFilters, HistoricalEvent, Importance } from "./types";

const event = (folders: { folderId: string; importance: Importance }[]): HistoricalEvent => ({
  id: "e",
  title: "t",
  type: "other",
  description: null,
  start: { year: 1453 },
  end: null,
  longitude: 0,
  latitude: 0,
  folders,
  characters: [],
  photos: [],
});

const filters = (
  folders: { folderId: string; importance: Importance | null }[],
): EventFilters => ({ folders });

describe("ce que le filtre laisse passer", () => {
  it("laisse tout passer quand rien n'est choisi", () => {
    expect(matchesFilters(event([]), filters([]))).toBe(true);
  });

  it("réunit les classeurs plutôt que de les croiser", () => {
    const shown = event([{ folderId: "renaissance", importance: "medium" }]);
    expect(
      matchesFilters(shown, filters([
        { folderId: "ottomans", importance: null },
        { folderId: "renaissance", importance: null },
      ])),
    ).toBe(true);
  });

  it("resserre sur l'importance demandée dans ce classeur", () => {
    const shown = event([{ folderId: "renaissance", importance: "low" }]);
    expect(matchesFilters(shown, filters([{ folderId: "renaissance", importance: "high" }]))).toBe(
      false,
    );
    expect(matchesFilters(shown, filters([{ folderId: "renaissance", importance: "low" }]))).toBe(
      true,
    );
  });

  it("écarte un événement rangé ailleurs", () => {
    const shown = event([{ folderId: "ottomans", importance: "high" }]);
    expect(matchesFilters(shown, filters([{ folderId: "renaissance", importance: null }]))).toBe(
      false,
    );
  });
});

describe("l'importance qui compte à l'écran", () => {
  const shown = event([
    { folderId: "ottomans", importance: "high" },
    { folderId: "renaissance", importance: "low" },
  ]);

  it("retient la plus forte quand rien n'est filtré", () => {
    expect(effectiveImportance(shown, filters([]))).toBe("high");
  });

  it("retient celle du classeur regardé", () => {
    expect(effectiveImportance(shown, filters([{ folderId: "renaissance", importance: null }]))).toBe(
      "low",
    );
  });

  it("se rabat sur l'ensemble quand l'événement n'est dans aucun classeur filtré", () => {
    expect(effectiveImportance(shown, filters([{ folderId: "autre", importance: null }]))).toBe(
      "high",
    );
  });
});
