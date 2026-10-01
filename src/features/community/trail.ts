/**
 * How many steps of the reading trail are kept drawn at once.
 *
 * The trail itself has no ceiling — an event names its classeur, that
 * classeur holds the event, and a reader can walk between the two all
 * afternoon — so "keep it all mounted" is unbounded memory, and the cost is
 * not the rows but the decoded photographs on every card below.
 *
 * Three is the top card and the two it came from, which makes two steps back
 * free; beyond that a card is rebuilt, which is a read and a scroll to the
 * top. Deep enough that nobody meets the edge by accident, shallow enough to
 * be a fixed cost.
 */
export const KEPT = 3;

/**
 * The steps to draw, each with the depth it actually stands at.
 *
 * The depth is what the card is keyed on, and it has to be the step's place
 * in the whole trail rather than its place in the window. The two differ as
 * soon as the trail is longer than the window, and a key built from the
 * window's own index would slide by one on every step — rebuilding the card
 * the reader is arriving at, which is the one thing this window exists to
 * protect. Pulled out of the component so the arithmetic can be tested
 * rather than trusted.
 */
export function windowed<T>(
  trail: T[],
  kept: number = KEPT,
): { step: T; depth: number }[] {
  const from = Math.max(0, trail.length - kept);
  return trail.slice(from).map((step, index) => ({ step, depth: from + index }));
}
