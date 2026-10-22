/**
 * Les quatre parties du monde qu'on peut réviser.
 *
 * Elles vivent dans leur propre module parce que trois autres les lisent — la
 * carte à étapes qui les propose, l'appel qui les transmet, le bandeau qui les
 * nomme pendant l'étude — et parce que le découpage lui-même est une décision,
 * pas une liste.
 *
 * **Le découpage se fait dans la base, sur l'ancre du territoire**, en quatre
 * règles exclusives dont la dernière ramasse le reste : voir la migration
 * `territories_to_study`. Il n'est pas répété ici, où il finirait par diverger.
 *
 * Le contour méditerranéen va avec l'Europe plutôt qu'avec l'Afrique : le
 * Maghreb, l'Égypte et le Levant se révisent avec Rome et Byzance, et
 * l'Afrique est alors celle qui commence au sud du Sahara. C'est ainsi qu'elles
 * ont été demandées, et c'est aussi ainsi qu'on apprend le pourtour d'une mer
 * — par la mer, et non par les continents qu'elle sépare.
 */
export type StudyPart = "americas" | "europe" | "africa" | "asia";

/**
 * Dans l'ordre où elles se présentent, d'ouest en est.
 *
 * Sans compte écrit à côté, et c'est voulu : le nombre de territoires d'une
 * partie du monde est une donnée de la base, qui changera au prochain
 * chargement du fond de carte. Un nombre recopié ici mentirait sans bruit.
 */
export const PARTS: { value: StudyPart; label: string }[] = [
  { value: "americas", label: "Amériques" },
  { value: "europe", label: "Europe et Méditerranée" },
  { value: "africa", label: "Afrique" },
  { value: "asia", label: "Asie et Océanie" },
];

/** Le nom d'une partie, pour le bandeau qui l'annonce pendant l'étude. */
export const PART_LABEL = Object.fromEntries(
  PARTS.map((part) => [part.value, part.label]),
) as Record<StudyPart, string>;
