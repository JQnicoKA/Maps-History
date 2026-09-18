/**
 * What counts as a password worth having.
 *
 * Four rules, all of them checkable while typing, none of them the kind that
 * pushes people to write the thing on a sticker: length does most of the work,
 * and the three character classes stop the obvious `motdepasse`. Length is
 * first and last — it is the rule that actually costs an attacker something.
 *
 * Kept apart from the screen so it can be read, tested, and used in one place
 * for both the meter and the button.
 */

export const MIN_LENGTH = 8;

export type Rule = { label: string; holds: (password: string) => boolean };

export const RULES: Rule[] = [
  {
    label: `${MIN_LENGTH} caractères ou plus`,
    holds: (password) => password.length >= MIN_LENGTH,
  },
  { label: "une minuscule", holds: (password) => /\p{Ll}/u.test(password) },
  { label: "une majuscule", holds: (password) => /\p{Lu}/u.test(password) },
  { label: "un chiffre", holds: (password) => /\d/.test(password) },
];

/** The rules this password fails, in the order they are shown. */
export const failures = (password: string): Rule[] =>
  RULES.filter((rule) => !rule.holds(password));

export const isStrong = (password: string): boolean =>
  failures(password).length === 0;

/**
 * How far along the four rules a password is, from 0 to 1.
 *
 * Length beyond the minimum counts for the last quarter, so a password that
 * merely satisfies the rules does not read as finished: `Motdepa1` is a pass,
 * `Motdepasse1789` is a good one, and the bar should say so.
 */
export function strength(password: string): number {
  if (password === "") return 0;
  const kept = RULES.filter((rule) => rule.holds(password)).length / RULES.length;
  const long = Math.min(password.length / (MIN_LENGTH * 2), 1);
  return Math.min(kept * 0.75 + long * 0.25, 1);
}

/** Is this the shape of an email address? The server decides; this is manners. */
export const looksLikeEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
