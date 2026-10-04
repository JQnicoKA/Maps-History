/**
 * What is really lost when something is deleted.
 *
 * Everything in this app can arrive two ways — written, or taken from
 * somebody else — and the two are not lost in the same way. Erasing what one
 * wrote is final. Erasing a copy costs nothing: its author's still stands
 * where it was taken from, and saying "c'est définitif" over a copy is
 * simply untrue.
 *
 * Written here rather than at each of the five places that asks, so that the
 * promise cannot drift between a territory and an event.
 */
export function stake(origin: string | null, own: string): string {
  return origin === null
    ? own
    : "Vous effacez votre copie ; celle de son auteur, dans la communauté, n'est pas touchée.";
}
