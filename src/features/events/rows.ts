import type { Move, Tree, TreeLink, TreeMember } from "./types";

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
 *
 * **Gaps elsewhere in the row survive.** Each block keeps the column its
 * leftmost member already occupies, and only shifts when the block before it
 * has grown into that column. A hole the reader left on purpose between two
 * families is not theirs to tidy away.
 */
export function tidy(tree: Tree, generation: number): Move[] {
  const moves: Move[] = [];
  let taken = -Infinity;

  for (const block of blocks(tree, generation)) {
    const first = block[0];
    if (!first) continue;

    // Where the block would like to start — where its leftmost member already
    // stands — unless the block before it has grown into that column. A
    // household gathering is allowed to push a stranger aside; it is not
    // allowed to land on top of one.
    const start = Math.max(first.position, taken + 1);
    block.forEach((member, step) => {
      const wanted = start + step;
      if (member.position !== wanted) moves.push({ id: member.id, position: wanted });
    });
    taken = start + block.length - 1;
  }
  return moves;
}

/**
 * A member's step to the left or to the right, as the moves it costs.
 *
 * Three different steps, and which one it is depends on what lies that way:
 *
 * - **A spouse beside them inside their own household**: they change places.
 *   Nothing else in the row moves — in `1 2 [3 4 5]`, sending 4 left gives
 *   `1 2 [4 3 5]`.
 * - **Empty space**: the household simply moves one column into it. This is
 *   what lets a reader push a family left until it sits under its parents, or
 *   leave a hole where nobody belongs.
 * - **Another household, immediately adjacent**: the two swap whole. Never
 *   half of one, which is what keeps a couple standing together.
 *
 * Columns are signed, so there is no left edge to bump into: pushing left from
 * the leftmost column reaches −1, and the drawing shifts everything at the
 * last moment (`span` in `genealogy/layout.ts`). Nobody else has to move for
 * one person to move.
 */
export function slide(tree: Tree, member: TreeMember, by: -1 | 1): Move[] {
  const order = blocks(tree, member.generation);
  const from = blockOf(tree, member);
  const household = order[from];
  if (from < 0 || !household) return [];

  // Inside the household: trade places with the spouse on that side.
  const rank = household.findIndex((one) => one.id === member.id);
  const mate = household[rank + by];
  const self = household[rank];
  if (mate && self) {
    return [
      { id: self.id, position: mate.position },
      { id: mate.id, position: self.position },
    ];
  }

  const neighbour = order[from + by];
  const edge =
    by === -1
      ? household[0]?.position
      : household[household.length - 1]?.position;
  if (edge === undefined) return [];

  // Empty space that way: step into it, and take the household along.
  const touching =
    neighbour !== undefined &&
    (by === -1
      ? (neighbour[neighbour.length - 1]?.position ?? -Infinity) === edge - 1
      : (neighbour[0]?.position ?? Infinity) === edge + 1);

  if (!touching) {
    return household.map((one) => ({ id: one.id, position: one.position + by }));
  }

  // Shoulder to shoulder: the two households exchange their stretches of row.
  if (!neighbour) return [];
  const moves: Move[] = [];
  const width = (block: TreeMember[]) => block.length;
  if (by === -1) {
    const start = neighbour[0]!.position;
    household.forEach((one, step) => moves.push({ id: one.id, position: start + step }));
    neighbour.forEach((one, step) =>
      moves.push({ id: one.id, position: start + width(household) + step }),
    );
  } else {
    const start = household[0]!.position;
    neighbour.forEach((one, step) => moves.push({ id: one.id, position: start + step }));
    household.forEach((one, step) =>
      moves.push({ id: one.id, position: start + width(neighbour) + step }),
    );
  }
  return moves.filter((move) => {
    const was = [...household, ...neighbour].find((one) => one.id === move.id);
    return was !== undefined && was.position !== move.position;
  });
}

/**
 * Where a dragged member is let go, as the moves it costs.
 *
 * The card under the finger lands on `column`; the rest of its household comes
 * along, keeping its order. Whoever stood there is pushed aside rather than
 * buried — a row never holds two people in one column.
 *
 * **Which way the bystanders go is decided once, and simply:** a block that
 * already lay left of where the household lands is pushed further left, one
 * that lay right is pushed right. Nobody crosses the arriving household, so
 * the row a reader knew is the row they get back, minus the hole the
 * household left and plus the one it made.
 *
 * Pushes cascade outwards — a displaced block can displace the next — but they
 * stop as soon as there is room, so gaps the reader left on purpose absorb the
 * movement instead of travelling to the end of the row.
 */
export function dropAt(tree: Tree, member: TreeMember, column: number): Move[] {
  const order = blocks(tree, member.generation);
  const index = blockOf(tree, member);
  const household = order[index];
  if (index < 0 || !household) return [];

  const rank = household.findIndex((one) => one.id === member.id);
  const start = column - rank;
  const end = start + household.length - 1;

  const moves: Move[] = [];
  const put = (one: TreeMember, position: number) => {
    if (one.position !== position) moves.push({ id: one.id, position });
  };

  household.forEach((one, step) => put(one, start + step));

  /**
   * Which side a bystander falls on is read from **where it stands**, not from
   * its rank in the row. Ranking was the first attempt and it was wrong: a
   * household dragged from the right end to column 0 would push the people
   * already there further left, off into the negatives, instead of aside.
   */
  const others = order.filter((_, i) => i !== index);
  const before = others.filter((block) => block[0]!.position < start);
  const after = others.filter((block) => block[0]!.position >= start);

  // Squeezed outwards from the landing: the nearest block first, so the far
  // ones only move if the near one has nowhere left to go.
  let free = start - 1;
  for (let i = before.length - 1; i >= 0; i--) {
    const block = before[i]!;
    const right = Math.min(block[block.length - 1]!.position, free);
    block.forEach((one, step) => put(one, right - (block.length - 1 - step)));
    free = right - block.length;
  }

  free = end + 1;
  for (const block of after) {
    const left = Math.max(block[0]!.position, free);
    block.forEach((one, step) => put(one, left + step));
    free = left + block.length;
  }

  return moves;
}

/** The line drawn directly between these two, if there is one. */
export function lineBetween(
  tree: Tree,
  a: string,
  b: string,
): TreeLink | undefined {
  return tree.links.find(
    (link) =>
      (link.from === a && link.to === b) || (link.from === b && link.to === a),
  );
}

/** Does this member hold any line at all? */
export function tied(tree: Tree, id: string): boolean {
  return tree.links.some((link) => link.from === id || link.to === id);
}

/**
 * Everything that must go when the line between two members is erased.
 *
 * A line is never quite alone. Erasing a marriage erases the children **of
 * that marriage** — the ones both spouses claim — because a child drawn hanging
 * from a bar that no longer exists belongs to nobody. Erasing one parent's
 * claim on a child erases the other parent's too, for the same reason read the
 * other way: what was said was "these two had this child", and half of that
 * sentence is not a smaller truth, it is a different one.
 *
 * Children claimed by only one of the two spouses are left alone: they were
 * never the couple's, and the line saying so is still true.
 */
export function erasure(tree: Tree, a: string, b: string): TreeLink[] {
  const line = lineBetween(tree, a, b);
  if (!line) return [];
  const going = [line];

  if (line.kind === "couple") {
    for (const child of childrenOf(tree, a)) {
      if (!claims(tree, b, child)) continue;
      const ours = tree.links.filter(
        (link) =>
          link.kind === "descent" &&
          link.to === child &&
          (link.from === a || link.from === b),
      );
      going.push(...ours);
    }
    return going;
  }

  // The other parent, if the two were married: a child has one set of parents.
  const child = line.to;
  for (const partner of spouses(tree, line.from)) {
    const theirs = lineBetween(tree, partner, child);
    if (theirs?.kind === "descent" && theirs.from === partner) going.push(theirs);
  }
  return going;
}

const childrenOf = (tree: Tree, id: string): string[] =>
  tree.links
    .filter((link) => link.kind === "descent" && link.from === id)
    .map((link) => link.to);

const claims = (tree: Tree, parent: string, child: string): boolean =>
  tree.links.some(
    (link) =>
      link.kind === "descent" && link.from === parent && link.to === child,
  );
