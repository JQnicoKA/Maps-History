import type { Importance } from "./types";

/**
 * Ce qui resserre une liste de collection.
 *
 * Deux questions seulement — dans quel classeur, et de quelle importance —
 * parce que ce sont les deux seules que les événements et les personnages
 * se posent de la même façon. Le reste de ce qui tamise dans cette
 * application appartient à la carte : les calques, l'année lue, l'étendue.
 * Une page nommée « Événements » montre des événements ; elle les range, elle
 * ne les cache pas pour des raisons venues d'ailleurs.
 */
export type Sift = {
  /** Les classeurs retenus ; vide veut dire tous. */
  folders: string[];
  /** Un cran, ou rien du tout. */
  importance: Importance | null;
};

export const NO_SIFT: Sift = { folders: [], importance: null };

/** Ce que le tamis demande aux choses qu'il tamise, et rien de plus. */
export type Siftable = {
  folders: string[];
  importance: Importance;
};

/**
 * Combien de questions sont posées.
 *
 * Le chiffre que porte la pastille — « Filtres · 2 » —, qui est la seule
 * chose disant qu'une liste est resserrée une fois le panneau refermé. Les
 * classeurs comptent pour un quel que soit leur nombre : ils sont une
 * question, « lesquels », et non une par classeur.
 */
export function narrowing(sift: Sift): number {
  return (sift.folders.length > 0 ? 1 : 0) + (sift.importance === null ? 0 : 1);
}

/**
 * Ce que le tamis laisse passer.
 *
 * Les classeurs se lisent en « l'un de » et non en « tous » : qui choisit
 * Mérovingiens et Capétiens veut voir les deux règnes, pas les quelques
 * événements rangés dans les deux à la fois.
 */
export function kept<T extends Siftable>(
  items: readonly T[],
  sift: Sift,
): T[] {
  if (narrowing(sift) === 0) return [...items];

  return items.filter((one) => {
    if (
      sift.folders.length > 0 &&
      !one.folders.some((folder) => sift.folders.includes(folder))
    ) {
      return false;
    }
    return sift.importance === null || one.importance === sift.importance;
  });
}
