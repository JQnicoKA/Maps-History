import type { HistoricalDate, HistoricalEvent } from "./types";

const MONTHS = [
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

export function formatYear(year: number): string {
  return year < 0 ? `${-year} av. J.-C.` : String(year);
}

export function formatHistoricalDate(date: HistoricalDate): string {
  const year = formatYear(date.year);
  if (date.month === undefined) return year;
  const month = MONTHS[date.month - 1] ?? "";
  return date.day === undefined
    ? `${month} ${year}`
    : `${date.day} ${month} ${year}`;
}

/** "1453" for an instant, "1337 – 1453" for a period. */
export function formatEventPeriod(event: HistoricalEvent): string {
  const start = formatHistoricalDate(event.start);
  return event.end ? `${start} – ${formatHistoricalDate(event.end)}` : start;
}
