import { describe, expect, it } from "vitest";

import { matchesFilters } from "./filtering";
import type { MapFilters, EventSummary, Importance } from "./types";

const event = (
  folders: string[],
  importance: Importance = "medium",
): EventSummary => ({
  id: "e",
  title: "t",
  type: "other",
  start: { year: 1453 },
  end: null,
  longitude: 0,
  latitude: 0,
  folders,
  importance,
  characters: [],
  cover: null,
  shared: true,
  origin: null,
});

const filters = (
  folders: string[],
  importance: Importance | null = null,
): MapFilters => ({
  folders,
  importance,
  events: true,
  characters: true,
  territories: true,
});

describe("ce que le filtre laisse passer", () => {
  it("laisse tout passer quand rien n'est choisi", () => {
    expect(matchesFilters(event([]), filters([]))).toBe(true);
  });

  it("réunit les classeurs plutôt que de les croiser", () => {
    const shown = event(["Renaissance"]);
    expect(matchesFilters(shown, filters(["Ottomans", "Renaissance"]))).toBe(
      true,
    );
  });

  it("écarte un événement rangé ailleurs", () => {
    expect(matchesFilters(event(["Ottomans"]), filters(["Renaissance"]))).toBe(
      false,
    );
  });

  it("écarte un événement rangé nulle part dès qu'un sujet est demandé", () => {
    expect(matchesFilters(event([]), filters(["Renaissance"]))).toBe(false);
  });

  it("resserre sur l'importance demandée", () => {
    const shown = event(["Renaissance"], "low");
    expect(matchesFilters(shown, filters([], "high"))).toBe(false);
    expect(matchesFilters(shown, filters([], "low"))).toBe(true);
  });

  it("croise les deux tamis : le sujet et l'importance", () => {
    const shown = event(["Renaissance"], "high");
    expect(matchesFilters(shown, filters(["Renaissance"], "high"))).toBe(true);
    expect(matchesFilters(shown, filters(["Ottomans"], "high"))).toBe(false);
    expect(matchesFilters(shown, filters(["Renaissance"], "low"))).toBe(false);
  });

  it("garde un événement non rangé quand seule l'importance est demandée", () => {
    expect(matchesFilters(event([], "high"), filters([], "high"))).toBe(true);
  });
});
