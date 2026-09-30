/**
 * What a pseudonym may be.
 *
 * The same four rules the database enforces, written here so the field can
 * say what is wrong while it is being typed rather than after a round trip.
 * They must not drift: the constraint `profiles_handle_shape` is the one that
 * decides, and this only tries to agree with it.
 *
 * Deliberately permissive about letters — accents, spaces and apostrophes all
 * belong in a name, and "Clio de Meaux" is a better pseudonym than
 * "clio_de_meaux". What it refuses is a name that starts with punctuation,
 * which is only ever an attempt to sort oneself to the top of a list.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;

/** Letters of any European alphabet, digits, and the three marks a name has. */
const SHAPE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 '-]*$/;

/**
 * Why this pseudonym cannot be used, or null if it can.
 *
 * A sentence rather than a code: it is shown as it is, under the field.
 */
export function handleProblem(handle: string): string | null {
  const trimmed = handle.trim();
  if (trimmed.length < HANDLE_MIN) {
    return `Il faut au moins ${HANDLE_MIN} caractères.`;
  }
  if (trimmed.length > HANDLE_MAX) {
    return `Pas plus de ${HANDLE_MAX} caractères.`;
  }
  if (!SHAPE.test(trimmed)) {
    return "Lettres, chiffres, espaces, tirets et apostrophes, en commençant par une lettre ou un chiffre.";
  }
  return null;
}

export const isHandle = (handle: string): boolean =>
  handleProblem(handle) === null;
