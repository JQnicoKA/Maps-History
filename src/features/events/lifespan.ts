import { formatYear } from "./historicalDate";
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
  if (birth && death) return `${formatYear(birth.year)} – ${formatYear(death.year)}`;
  if (birth) return `né en ${formatYear(birth.year)}`;
  if (death) return `† ${formatYear(death.year)}`;
  return "";
}
