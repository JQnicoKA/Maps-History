/**
 * Comparer et chercher des noms de classeurs.
 *
 * Tiré de `FolderSelector`, où ces trois fonctions vivaient enfermées, le
 * jour où la bibliothèque a reçu le même filtre : deux listes de classeurs
 * qui se tamisent côte à côte doivent se tamiser pareil, et une seconde
 * table d'accents aurait divergé de la première à la première lettre
 * ajoutée.
 *
 * Pur, sans rien de React Native : c'est ce qui le rend testable.
 */

/**
 * Les accents retirés, lettre par lettre.
 *
 * Écrit à la main plutôt que par `normalize("NFD")` et une classe Unicode :
 * ce code tourne sur Hermes, et une table de sept lettres françaises est sûre
 * là où les échappements de propriété Unicode sont un pari. Ce qu'elle couvre
 * est exactement ce qu'un nom de classeur français contient.
 */
const PLATS: Record<string, string> = {
  à: "a", â: "a", ä: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  î: "i", ï: "i",
  ô: "o", ö: "o",
  ù: "u", û: "u", ü: "u",
  ç: "c",
  œ: "oe", æ: "ae",
};

/** Le nom à plat : sans capitales et sans accents, bon à comparer. */
export const plat = (said: string): string =>
  said
    .toLowerCase()
    .split("")
    .map((lettre) => PLATS[lettre] ?? lettre)
    .join("");

/** Les espaces en trop ôtés : « Guerres  de religion » n'est pas un nom neuf. */
export const propre = (said: string): string =>
  said.trim().replace(/\s+/g, " ");

/**
 * Le même nom, à la casse et aux accents près.
 *
 * Le seul vrai défaut du classement par étiquette : « Carolingiens » tapé
 * deux fois différemment ferait deux sujets là où il y en a un. On s'en garde
 * en ramenant ce qui est tapé à ce qui est déjà écrit — et non pas en
 * interdisant de taper, ce qui empêcherait d'en nommer un nouveau.
 */
export const same = (a: string, b: string): boolean => plat(a) === plat(b);

/** Ceux qui portent ce qu'on a tapé, accents et capitales indifférents. */
export const matching = (names: string[], typed: string): string[] => {
  const wanted = propre(typed);
  if (wanted === "") return names;
  const flat = plat(wanted);
  return names.filter((name) => plat(name).includes(flat));
};
