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
  const at = placeOf(a);
  const bt = placeOf(b);
  return at === bt ? a.name.localeCompare(b.name) : at - bt;
}

function placeOf(person: Character): number {
  const date = person.birth ?? person.death;
  return date === null ? -Infinity : toSortKey(date);
}
