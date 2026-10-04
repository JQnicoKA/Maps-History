import { formatDateYear, toSortKey } from "./historicalDate";
import type { Character } from "./types";

/**
 * A life in as few characters as it takes: "1769 – 1821", "né en 1769",
 * "† 1821", or nothing at all when neither date is known.
 *
 * Years only. The day someone was born matters on their card; in a list of
 * names it is noise, and the point of the line is to place them in a century.
 */
export function lifespan(person: Character): string {
  const { birth, death } = person;
  if (birth && death) return `${formatDateYear(birth)} – ${formatDateYear(death)}`;
  if (birth) return `né en ${formatDateYear(birth)}`;
  if (death) return `† ${formatDateYear(death)}`;
  return "";
}

/**
 * Oldest first, and the undated before everyone.
 *
 * A birth places someone; failing that a death does, roughly but well enough.
 * Someone with neither is not "very old" — they are unplaced, and the top of
 * the list is where unfinished things belong, in sight rather than buried at
 * the end. Hence minus infinity rather than a guessed year.
 *
 * Names break ties, so the order never wobbles between two readings.
 */
export function compareByLife(a: Character, b: Character): number {
  const at = momentOf(a);
  const bt = momentOf(b);
  return at === bt ? a.name.localeCompare(b.name) : at - bt;
}

/**
 * Où quelqu'un se place sur l'axe du temps, dans la même unité qu'un
 * événement — ce qui permet de ranger les deux dans une seule liste.
 *
 * Exporté pour la vue liste, qui entremêle les uns et les autres ; la règle
 * reste celle de `compareByLife`, et elle ne doit exister qu'une fois.
 */
export function momentOf(person: Character): number {
  const date = person.birth ?? person.death;
  return date === null ? -Infinity : toSortKey(date);
}

/**
 * Where someone stands, if they stand anywhere.
 *
 * Both halves or neither: the database enforces the pair, and a longitude
 * without a latitude is not a place. Narrowing here is what lets the callers
 * read `.longitude` without a second check.
 */
export function placeOfPerson(
  person: Character,
): { longitude: number; latitude: number } | null {
  const { longitude, latitude } = person;
  return longitude === null || latitude === null
    ? null
    : { longitude, latitude };
}

/**
 * Is this person on the plate in the year the reader is looking at?
 *
 * A life is a span like an event's: it opens at the birth and closes at the
 * death. Three things can keep someone off the map.
 *
 * - **No place.** Only the people written down before the map knew about them;
 *   the form asks for one now.
 * - **No birth.** There is no moment to start from, and starting "whenever"
 *   would put them everywhere.
 * - **The year is outside the span.** The ordinary case.
 *
 * An unknown death does *not* close the span. It is the honest reading: a
 * death one has not written down is a death one does not know, and guessing a
 * lifetime would make the map claim something the collection never said.
 */
export function standsAt(person: Character, year: number): boolean {
  if (placeOfPerson(person) === null) return false;
  if (person.birth === null) return false;
  if (toSortKey(person.birth) > year) return false;
  return person.death === null || toSortKey(person.death) >= year;
}
