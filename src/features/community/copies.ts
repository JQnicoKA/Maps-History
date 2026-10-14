/**
 * Why a copy has nothing to offer the library.
 *
 * Prendre une copie, c'est faire venir sur sa carte une entrée de la
 * bibliothèque. L'ouvrir à son tour à la bibliothèque serait lui proposer ce
 * qu'elle a déjà écrit : l'entrée d'origine est la sienne. La règle est donc
 * simplement qu'une copie reste chez soi.
 *
 * La raison a changé en route. Elle était « sinon le catalogue compterait
 * cent Marignan » — la jungle que la curation a défaite. Elle est maintenant
 * qu'il n'y a rien à apporter. La règle, elle, n'a pas bougé.
 *
 * **Trees are the exception, and `TreeBuilder` therefore never calls this.**
 * A genealogy taken from someone else is a starting point rather than a
 * finished thing: a reader adds a branch, corrects a filiation, carries it
 * three generations further, and what they end with is their own work and
 * worth offering back. The other four arrive complete, and a copy of a
 * complete thing is only a copy.
 *
 * The same rule is a CHECK constraint on the four tables — see the migration
 * `a_copy_stays_private_except_a_tree`. This function is what says it in
 * words; the database is what makes it true.
 *
 * @param origin The row this was taken from, null for something written here.
 * @returns The sentence to show instead of the choice, or null if there is a
 *   choice to make.
 */
export function whyLocked(origin: string | null): string | null {
  return origin === null
    ? null
    : "Une copie reste chez vous : la bibliothèque a déjà l'entrée dont elle vient.";
}
