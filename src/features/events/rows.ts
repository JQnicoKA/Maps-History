import type { Move, Tree, TreeMember } from "./types";

/**
 * The one rule a row of a genealogy obeys: **a couple stands together.**
 *
 * Without it the drawing lies. The bar joining two spouses is horizontal, so a
 * stranger left between them is crossed straight through and reads as part of
 * the marriage. Rather than forbid the move, the row is kept in a state where
 * the question cannot arise: couples are blocks, spouses rearrange freely
 * inside their block, and a block only ever moves whole.
 *
 * Pure, and next to the tree's own types rather than in the drawing code, since
 * this is what the data means and not how it looks.
 */

/** Everyone standing on one row, left to right. */
export function row(tree: Tree, generation: number): TreeMember[] {
  return tree.members
    .filter((member) => member.generation === generation)
    .sort((a, b) => a.position - b.position);
}

/**
 * Everyone tied to this member by marriage, themselves included.
 *
 * Transitive, because a couple link is drawn from one person to each of the
 * others: a household of three or four is one chain of links, and splitting it
 * in two would put a stranger in the middle of it.
 */
export function couple(tree: Tree, id: string): Set<string> {
  const held = new Set([id]);
  for (let growing = true; growing; ) {
    growing = false;
    for (const link of tree.links) {
      if (link.kind !== "couple") continue;
      if (held.has(link.from) && !held.has(link.to)) {
        held.add(link.to);
        growing = true;
      } else if (held.has(link.to) && !held.has(link.from)) {
        held.add(link.from);
        growing = true;
      }
    }
  }
  return held;
}

/**
 * Who this member is married to — at most one person now.
 *
 * A pair and not a household: three people on one couple link produced a row
 * nobody could read, and a man with three wives is drawn three times instead,
 * once beside each of them.
 */
export function spouses(tree: Tree, id: string): string[] {
  const found: string[] = [];
  for (const link of tree.links) {
    if (link.kind !== "couple") continue;
    if (link.from === id) found.push(link.to);
    else if (link.to === id) found.push(link.from);
  }
  return found;
}

/**
 * The row as the blocks it is made of: each couple whole, each single alone,
 * in the order they are read.
 *
 * A block's own members keep the order they had, so tidying a row never
 * shuffles a household the reader has already arranged.
 */
export function blocks(tree: Tree, generation: number): TreeMember[][] {
  const standing = row(tree, generation);
  const placed = new Set<string>();
  const out: TreeMember[][] = [];

  for (const member of standing) {
    if (placed.has(member.id)) continue;
    const held = couple(tree, member.id);
    // Filtered against the row, so a link to someone on another generation —
    // which nothing in the app draws — cannot drag them into this one.
    const block = standing.filter((one) => held.has(one.id));
    for (const one of block) placed.add(one.id);
    out.push(block);
  }
  return out;
}

/** Which block of its row this member stands in, for "can it go left?". */
export function blockOf(tree: Tree, member: TreeMember): number {
  return blocks(tree, member.generation).findIndex((block) =>
    block.some((one) => one.id === member.id),
  );
}

/**
 * The moves that pull every couple of a row together, and nothing more.
 *
 * Whoever is met first keeps their place and their household is gathered
 * around them, so the row a reader knows stays broadly the row they get: a
 * spouse is fetched to their partner rather than the whole line redrawn.
 */
export function tidy(tree: Tree, generation: number): Move[] {
  return renumber(blocks(tree, generation));
}

/**
 * A member's step to the left or to the right, as the moves it costs.
 *
 * Two different steps, and which one it is depends on where in their household
 * they stand:
 *
 * - **Inside it**, they simply change places with the spouse next to them. The
 *   household does not move, so neither does anyone else in the row: in `1 2
 *   [3 4 5]`, sending 4 left gives `1 2 [4 3 5]`.
 * - **At its edge**, there is no spouse to trade with, so the whole household
 *   steps over the neighbouring block — a single person or another household,
 *   never half of one. In the same row, sending 3 left gives `1 [3 4 5] 2`.
 *
 * A single person is a household of one and is therefore always at its edge,
 * which is why this reads as a plain swap for everyone unmarried.
 */
export function slide(tree: Tree, member: TreeMember, by: -1 | 1): Move[] {
  const order = blocks(tree, member.generation);
  const from = blockOf(tree, member);
  const household = order[from];
  if (from < 0 || !household) return [];

  const rank = household.findIndex((one) => one.id === member.id);
  const spouse = rank + by;
  if (spouse >= 0 && spouse < household.length) {
    const swapped = [...household];
    const moving = household[rank];
    const displaced = household[spouse];
    if (!moving || !displaced) return [];
    swapped[rank] = displaced;
    swapped[spouse] = moving;
    const rearranged = [...order];
    rearranged[from] = swapped;
    return renumber(rearranged);
  }

  const to = from + by;
  if (to < 0 || to >= order.length) return [];
  const rearranged = [...order];
  const displaced = rearranged[to];
  if (!displaced) return [];
  rearranged[from] = displaced;
  rearranged[to] = household;
  return renumber(rearranged);
}

/** Positions 0, 1, 2… over the given order — reporting only what changes. */
function renumber(order: TreeMember[][]): Move[] {
  const moves: Move[] = [];
  let position = 0;
  for (const block of order) {
    for (const member of block) {
      if (member.position !== position) moves.push({ id: member.id, position });
      position += 1;
    }
  }
  return moves;
}
