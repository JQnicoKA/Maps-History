import { toSortKey } from "../events/historicalDate";
import type { HistoricalDate } from "../events/types";

/**
 * How wide a period is worth offering, given how precisely it was stated.
 *
 * A reader who typed the 14th of July 1789 is asking about a day, and "give
 * or take fifty years" is not a refinement of that — it is a different
 * question. One who typed 1789 alone cannot be offered a week either side,
 * because they never claimed to know the week. So the three widths follow the
 * precision of the answer:
 *
 * - **a day**   → a week, a month, a year
 * - **a month** → a month, a year, ten years
 * - **a year**  → ten years, fifty, a hundred
 *
 * Measured in years, fractional, on the same continuous axis the database
 * indexes — see `toSortKey`, whose formula the generated `from_key` column
 * repeats. A week is 7/372 of a year there, because that axis divides a year
 * into twelve months of thirty-one days.
 */
export type Width = { label: string; years: number };

const WEEK = 7 / 372;
const MONTH = 1 / 12;

const BY_DAY: Width[] = [
  { label: "± 1 semaine", years: WEEK },
  { label: "± 1 mois", years: MONTH },
  { label: "± 1 an", years: 1 },
];

const BY_MONTH: Width[] = [
  { label: "± 1 mois", years: MONTH },
  { label: "± 1 an", years: 1 },
  { label: "± 10 ans", years: 10 },
];

const BY_YEAR: Width[] = [
  { label: "± 10 ans", years: 10 },
  { label: "± 50 ans", years: 50 },
  { label: "± 100 ans", years: 100 },
];

export function widthsFor(date: HistoricalDate): Width[] {
  if (date.day !== undefined) return BY_DAY;
  if (date.month !== undefined) return BY_MONTH;
  return BY_YEAR;
}

/**
 * The two bounds a date and a width make, on the continuous axis.
 *
 * Null for either when there is nothing to bound — which is what "toute
 * l'histoire" means, whatever date is in the wheels.
 */
export function bounds(
  date: HistoricalDate | null,
  width: number | null,
): { since: number | null; until: number | null } {
  if (date === null || width === null) return { since: null, until: null };
  const at = toSortKey(date);
  return { since: at - width, until: at + width };
}
