import type { EventSummary, HistoricalDate } from "./types";

/** Shared with the date wheels, so the two can never disagree. */
export const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * Position on a continuous axis, used to sort events and to place them on the
 * timeline. Fractional part is approximate on purpose — it only has to order
 * dates within a year, never to measure a duration.
 */
export function toSortKey({ year, month, day }: HistoricalDate): number {
  return year + ((month ?? 1) - 1) / 12 + ((day ?? 1) - 1) / 372;
}

/**
 * L'année qui contient une position de l'axe.
 *
 * Arrondie vers le bas, jamais à la plus proche : le 23 décembre 487 vaut
 * 487,98 sur l'axe, et l'arrondi l'affichait en 488 — la frise, les villes et
 * les frontières avançaient d'un an dès le second semestre. Vers le bas aussi
 * avant Jésus-Christ : décembre de -50 vaut -49,08, qui doit rester -50, ce
 * que `Math.trunc` ne fait pas.
 */
export function yearOf(at: number): number {
  return Math.floor(at);
}

/**
 * The mark an uncertain date wears, wherever it is written.
 *
 * One tilde, in one place, so a date cannot be approximate in the detail sheet
 * and certain on the marker. Every date the app prints goes through here.
 */
export const ABOUT = "~";

const about = (date: HistoricalDate): string =>
  date.approximate === true ? ABOUT : "";

/** A date's year alone, tilde included — for lists and rules. */
export function formatDateYear(date: HistoricalDate): string {
  return `${about(date)}${formatYear(date.year)}`;
}

export function formatYear(year: number): string {
  return year < 0 ? `${-year} av. J.-C.` : String(year);
}

export function formatHistoricalDate(date: HistoricalDate): string {
  const year = formatYear(date.year);
  if (date.month === undefined) return `${about(date)}${year}`;
  const month = MONTHS[date.month - 1] ?? "";
  return date.day === undefined
    ? `${about(date)}${month} ${year}`
    : `${about(date)}${date.day} ${month} ${year}`;
}

/** "1453" for an instant, "1337 – 1453" for a period. */
export function formatEventPeriod(event: EventSummary): string {
  const start = formatHistoricalDate(event.start);
  return event.end ? `${start} – ${formatHistoricalDate(event.end)}` : start;
}
