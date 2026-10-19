import type { Character, MapFilters, EventSummary } from "./types";

/**
 * Deux questions indépendantes, et il faut passer les deux.
 *
 * Le classement et l'importance. Le premier a été détaché en
 * `matchesFolders` le jour où les personnages ont pris les mêmes classeurs :
 * eux n'ont pas d'importance — elle appartient à ce qui s'est passé, pas à
 * qui l'a fait —, donc ils ne posent que la première des deux questions.
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
  return (
    matchesFolders(event, filters) &&
    (filters.importance === null || event.importance === filters.importance)
  );
}

/**
 * Le tamis des classeurs seul, parce qu'il sert aux deux genres.
 *
 * Un personnage se range sous les mêmes sujets qu'un événement, mais il n'a
 * pas d'importance — celle-ci appartient à ce qui s'est passé, pas à qui l'a
 * fait. Les deux questions sont donc séparées ici, et les personnages ne
 * posent que la première.
 *
 * Les classeurs se réunissent : choisir deux sujets montre ce qui appartient
 * à l'un **ou** à l'autre. Aucun sujet choisi ne filtre rien — c'est « tout »
 * et non « rien », parce qu'un tamis vide ne tamise pas.
 */
export function matchesFolders(
  filed: Pick<EventSummary | Character, "folders">,
  filters: MapFilters,
): boolean {
  return (
    filters.folders.length === 0 ||
    filed.folders.some((name) => filters.folders.includes(name))
  );
}
