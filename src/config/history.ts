/**
 * The stretch of time this app lets you move through.
 *
 * One range, used by the frieze that scrolls through it and by the wheels that
 * let you type a date into it — they were two numbers apart before, and a date
 * you could enter but never scroll to is a quiet contradiction.
 *
 * The lower bound is where Cliopatria's earliest polities sit; the upper one is
 * past the present with room to spare.
 */
export const HISTORY = { from: -3000, to: 2100 } as const;

/**
 * Where the frieze opens when there is no event to open on — an empty app, or
 * one whose filters match nothing.
 *
 * Not today's date: the borders stop in 2024, so opening on the present would
 * show an empty world and read as a failure. The turn of the millennium has
 * full coverage and is the map most people can place themselves on.
 */
export const DEFAULT_YEAR = 2000;
