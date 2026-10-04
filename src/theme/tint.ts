import { palette } from "./palette";

/**
 * A photograph's colour, laid in the app's wax.
 *
 * The dominant colour of a portrait is computed once when it is uploaded and
 * kept on its row — see the `tint` Edge Function. This is the other half: what
 * a card may actually be painted with.
 *
 * **Only the hue survives the journey.** A photograph's own saturation and
 * lightness are whatever the light that day happened to be, and three things
 * break if they are let through:
 *
 * 1. the cream label text stops reading on a pale card;
 * 2. an arbitrary colour leaves the parchment world the rest of the app lives
 *    in, and a blue sky behind a grandfather turns his card sky-blue;
 * 3. a tree node's opacity already carries how much that person matters, and a
 *    washed-out colour at 0.5 would make `low` and `high` indistinguishable —
 *    trading one signal away to gain another.
 *
 * Keeping the hue and forcing the wax's own saturation and luminance answers
 * all three at once, and leaves exactly what was wanted: a card that is
 * recognisably *this* person's, in a family the parchment admits.
 */

/** Hue in degrees, saturation and lightness in 0–1. */
type Hsl = { h: number; s: number; l: number };

const toHsl = (hex: string): Hsl => {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  const spread = high - low;
  const l = (high + low) / 2;
  const s = spread === 0 ? 0 : spread / (1 - Math.abs(2 * l - 1));

  if (spread === 0) return { h: 0, s, l };
  const h =
    high === r
      ? ((g - b) / spread) % 6
      : high === g
        ? (b - r) / spread + 2
        : (r - g) / spread + 4;
  // `+ 360` before the modulo: the first branch is negative for anything
  // leaning towards magenta.
  return { h: (h * 60 + 360) % 360, s, l };
};

/** The three channels, 0–1, so luminance and hex can share the work. */
const channels = ({ h, s, l }: Hsl): [number, number, number] => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [r + m, g + m, b + m];
};

const toHex = (colour: Hsl): string =>
  "#" +
  channels(colour)
    .map((channel) =>
      Math.round(Math.max(0, Math.min(1, channel)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

/** sRGB relative luminance, the quantity contrast ratios are built from. */
const luminance = (colour: Hsl): number => {
  const [r, g, b] = channels(colour).map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4),
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * The wax, measured rather than written down.
 *
 * Read from the palette at load so the two can never drift: change `wax` and
 * every derived card follows it.
 */
const WAX = toHsl(palette.wax);
const WAX_LUMINANCE = luminance(WAX);

/**
 * The wax as this module spells it.
 *
 * Lower case, because every colour this module *computes* is lower case, and
 * a function with one output shape is easier to test and to compare than one
 * that hands back the palette's capitals down one path and its own lower case
 * down the other. Same colour either way.
 */
const WAX_HEX = palette.wax.toLowerCase();

/**
 * HSL lightness is not luminance, and the gap is the whole problem.
 *
 * At the wax's own lightness, an olive hue sits at 2.8:1 against the cream
 * label while an indigo sits at 9.1:1 — the first is illegible and the second
 * shouts. Measured, not guessed: see the table in the tests.
 *
 * So the lightness is **solved for** instead of fixed: the one that gives this
 * hue the wax's own luminance. Luminance rises monotonically with lightness at
 * a fixed hue and saturation, so a bisection always lands, and twenty-four
 * halvings put it well inside a rounding step of one channel.
 *
 * The result is then capped at the wax's own lightness, which is what keeps
 * the blues from turning vivid. Capping is free: going *darker* than the
 * target luminance only widens the contrast with a cream label, never narrows
 * it. Two guarantees fall out, and they are the whole contract — **no card is
 * lighter than the wax, and no card reads worse than the wax.**
 */
const lightnessFor = (h: number): number => {
  const atWax: Hsl = { h, s: WAX.s, l: WAX.l };
  if (luminance(atWax) <= WAX_LUMINANCE) return WAX.l;

  let dark = 0;
  let light = WAX.l;
  for (let step = 0; step < 24; step += 1) {
    const middle = (dark + light) / 2;
    if (luminance({ h, s: WAX.s, l: middle }) < WAX_LUMINANCE) dark = middle;
    else light = middle;
  }
  return (dark + light) / 2;
};

/** Memoised: a tree re-renders often, and a hue always gives the same card. */
const painted = new Map<string, string>();

/**
 * The colour to paint a card, given the dominant colour of its photograph.
 *
 * Null — no photograph, or a photograph with no colour in it, such as a
 * daguerreotype — gives the wax, which is the default and always was.
 *
 * The wax itself round-trips to the wax exactly, by construction: its own hue
 * solved against its own luminance is its own lightness.
 */
export function inWax(tint: string | null | undefined): string {
  if (tint == null || !/^#[0-9a-f]{6}$/i.test(tint)) return WAX_HEX;

  const known = painted.get(tint);
  if (known !== undefined) return known;

  const { h } = toHsl(tint.toLowerCase());
  const card = toHex({ h, s: WAX.s, l: lightnessFor(h) });
  painted.set(tint, card);
  return card;
}

/**
 * The contrast ratio between a card and the cream it is labelled in.
 *
 * Exported for the tests, which assert the contract above across every hue
 * rather than trusting that the bisection was written correctly.
 */
export function contrastWithLabel(card: string): number {
  const one = luminance(toHsl(card));
  const two = luminance(toHsl(palette.paperLight));
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}
