import type { MapFilters, EventSummary } from "./types";

/**
 * Deux questions indépendantes, et il faut passer les deux.
 *
 * Les classeurs se réunissent : choisir deux sujets montre les événements de
 * l'un ou de l'autre. L'importance, elle, est un seul tamis — elle appartient
 * à l'événement, plus au couple (événement, classeur), donc elle ne se
 * demande qu'une fois.
 *
 * Ce qui a disparu avec ce déménagement : `effectiveImportance`, qui retenait
 * la plus forte des importances d'un événement parmi les classeurs regardés.
 * Elle existait pour qu'un événement majeur d'un sujet ne soit pas dessiné
 * comme mineur d'un autre — un cas que la base n'a jamais contenu, et qu'aucun
 * appelant hors de son test n'a jamais demandé.
 */
export function matchesFilters(
  event: EventSummary,
  filters: MapFilters,
): boolean {
  if (
    filters.folders.length > 0 &&
    !event.folders.some((name) => filters.folders.includes(name))
  ) {
    return false;
  }

  return filters.importance === null || event.importance === filters.importance;
}
