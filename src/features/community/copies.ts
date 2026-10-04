/**
 * Why a copy cannot be offered to the chronicle.
 *
 * Taking a copy is how a reader gets somebody else's work onto their own map.
 * Letting them share it again would put a second Marignan in the catalogue
 * beside the first — same words, none of the stars, none of the history — and
 * the hundred and first reader would have a hundred Marignans to choose
 * between. The rule that prevents that is simply: a copy stays home.
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
    : "Une copie reste chez vous : pour que la communauté ne compte pas dix fois la même chose, elle ne peut pas y retourner.";
}
