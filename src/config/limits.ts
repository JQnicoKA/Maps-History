/**
 * Les longueurs les plus grandes qu'accepte la base.
 *
 * Elles sont aussi écrites en contraintes dans la migration
 * `les_textes_ont_une_longueur_maximale` : la base refuse au-delà, quel que
 * soit le client qui écrit. Ici, elles servent à plafonner les champs pour que
 * le lecteur ne rencontre jamais ce refus. Changer l'une sans l'autre ferait
 * soit un champ qui accepte ce que la base rejette, soit une limite inutile.
 *
 * Toutes sont larges : le plus long titre écrit jusqu'ici fait 61 caractères,
 * la plus longue description 1 472. Il s'agit d'empêcher qu'on remplisse la
 * base, pas de gêner qui écrit.
 */
export const LIMITS = {
  /** Titre d'un événement. */
  title: 200,
  /** Nom d'un personnage, d'un arbre, d'un territoire ou d'une ville dessinés. */
  name: 120,
  /** Description d'un événement, récit d'un personnage. */
  story: 10_000,
  /** Nom d'un classeur. */
  folder: 60,
  /** Classeurs sur un même événement ou personnage. */
  folders: 30,
  /** Source d'une photo : un lien ou une référence. */
  source: 500,
  /** Étiquette posée dans un arbre. */
  label: 80,
} as const;
