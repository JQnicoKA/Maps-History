import type { Character, MapFilters, EventSummary } from "./types";

/**
 * Ce que le filtre de la planche laisse passer.
 *
 * **Deux questions indépendantes, et il faut passer les deux** : le classement
 * et l'importance.
 *
 * Elles valaient d'abord pour les seuls événements, puis le classement a été
 * détaché en `matchesFolders` le jour où les personnages ont pris les mêmes
 * classeurs — eux n'avaient pas d'importance, qui appartenait alors à ce qui
 * s'était passé et non à qui l'avait fait. **Ce n'est plus vrai** : un
 * personnage porte désormais la sienne, choisie sur sa fiche. Les deux genres
 * répondent donc aux deux questions, et il n'y a plus qu'un tamis.
 *
 * Ce qui a disparu avec le déménagement d'alors : `effectiveImportance`, qui
 * retenait la plus forte des importances d'un événement parmi les classeurs
 * regardés. Elle existait pour qu'un événement majeur d'un sujet ne soit pas
 * dessiné comme mineur d'un autre — un cas que la base n'a jamais contenu, et
 * qu'aucun appelant hors de son test n'a jamais demandé.
 */
export function matchesFilters(
  filed: Pick<EventSummary | Character, "folders" | "importance">,
  filters: MapFilters,
): boolean {
  return (
    matchesFolders(filed, filters) &&
    (filters.importance === null || filed.importance === filters.importance)
  );
}

/**
 * Le tamis des classeurs seul.
 *
 * Gardé à part de `matchesFilters` bien que les deux genres posent désormais
 * les deux questions : un classement se lit sur n'importe quoi qui en porte,
 * et séparer les deux rend chacune éprouvable sans l'autre.
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
