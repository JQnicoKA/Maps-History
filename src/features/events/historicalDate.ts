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

/** Parses a signed year; "-330" and "330 av" both mean 330 BC. */
export function parseYear(input: string): number | null {
  const negative = /av/i.test(input);
  const digits = input.replace(/[^\d-]/g, "");
  const value = Number.parseInt(digits, 10);
  if (Number.isNaN(value) || value === 0) return null;
  return negative ? -Math.abs(value) : value;
}

function parseWithin(input: string, min: number, max: number): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const value = Number.parseInt(trimmed, 10);
  if (Number.isNaN(value) || value < min || value > max) return null;
  return value;
}

export type DateFields = { year: string; month: string; day: string };

export const EMPTY_DATE_FIELDS: DateFields = { year: "", month: "", day: "" };

/**
 * Turns the three raw inputs into a date, or explains what is wrong. A day
 * without a month is rejected — the database enforces the same rule.
 */
export function buildHistoricalDate(
  fields: DateFields,
): { date: HistoricalDate } | { error: string } {
  const year = parseYear(fields.year);
  if (year === null) return { error: "Année manquante ou invalide." };

  const month = parseWithin(fields.month, 1, 12);
  if (month === null && fields.month.trim() !== "") {
    return { error: "Le mois doit être un nombre entre 1 et 12." };
  }

  const day = parseWithin(fields.day, 1, 31);
  if (day === null && fields.day.trim() !== "") {
    return { error: "Le jour doit être un nombre entre 1 et 31." };
  }
  if (day !== null && month === null) {
    return { error: "Un jour ne peut pas être précisé sans son mois." };
  }

  return {
    date: {
      year,
      ...(month !== null ? { month } : {}),
      ...(day !== null ? { day } : {}),
    },
  };
}

export function toDateFields(date: HistoricalDate | null): DateFields {
  if (!date) return EMPTY_DATE_FIELDS;
  return {
    year: String(date.year),
    month: date.month === undefined ? "" : String(date.month),
    day: date.day === undefined ? "" : String(date.day),
  };
}
