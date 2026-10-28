import type { Character, Tree, TreeMember } from "../events/types";

/**
 * Qui représente un arbre : sa tête.
 *
 * **Le plus haut, et parmi les plus hauts le plus marquant.** Un arbre se lit
 * du fondateur vers les descendants, donc la première génération le désigne
 * mieux qu'aucune autre ; et si elle compte plusieurs personnes, c'est celle
 * dont on a dit qu'elle comptait qui doit paraître.
 *
 * L'importance l'emporte sur le rang **à l'intérieur de ce qu'on a trouvé de
 * plus haut**, et non dans tout l'arbre : un petit-fils majeur ne représente
 * pas la lignée de son grand-père. On cherche donc la plus haute génération
 * qui porte quelqu'un de majeur, et c'est le premier de celle-là.
 *
 * Les étiquettes ne comptent pas — ce sont des cartouches, pas des gens.
 */
export function headOf(
  tree: Pick<Tree, "members">,
  people: readonly Pick<Character, "id" | "importance">[],
): string | null {
  const persons = tree.members
    .filter(
      (member): member is Extract<TreeMember, { kind: "person" }> =>
        member.kind === "person",
    )
    /* Haut d'abord, puis la gauche — l'ordre dans lequel on lit un dessin.
       `position` départage à génération égale, et le tri est stable sans lui
       seulement si la base rend toujours le même ordre, ce qu'elle ne
       promet pas. */
    .sort((a, b) => a.generation - b.generation || a.position - b.position);

  if (persons.length === 0) return null;

  const weighs = new Map(people.map((one) => [one.id, one.importance]));
  const major = persons.find(
    (one) => weighs.get(one.characterId) === "high",
  );

  /* À défaut de quelqu'un de majeur, le plus haut tout court : un arbre dont
     personne n'a été distingué se représente quand même. */
  return (major ?? persons[0]!).characterId;
}
