/**
 * Ce qu'une copie effacée coûte vraiment : rien.
 *
 * Écrite ici et importée par les cinq endroits qui la disent, parce que la
 * promesse avait déjà glissé une fois — quatre d'entre eux parlaient encore
 * de « celle de son auteur, dans la communauté », là où il n'y a plus ni
 * communauté ni auteur affiché.
 */
export const COPY_IS_A_COPY =
  "Vous effacez votre copie ; l'entrée de la bibliothèque dont elle vient n'est pas touchée.";

/**
 * What is really lost when something is deleted.
 *
 * Everything in this app can arrive two ways — written, or taken from
 * somebody else — and the two are not lost in the same way. Erasing what one
 * wrote is final. Erasing a copy costs nothing: l'entrée de la bibliothèque
 * dont elle vient est toujours là, et dire « c'est définitif » au-dessus
 * d'une copie est simplement faux.
 *
 * Written here rather than at each of the five places that asks, so that the
 * promise cannot drift between a territory and an event.
 */
export function stake(origin: string | null, own: string): string {
  return origin === null ? own : COPY_IS_A_COPY;
}
