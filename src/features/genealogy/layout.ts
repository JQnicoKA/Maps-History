import type { Tree, TreeMember } from "../events/types";

/**
 * How big a face is drawn. One size, for everyone.
 *
 * Weight in the tree is carried by opacity instead (`TreeNode`), so a portrait
 * is never shrunk: a face is a likeness before it is a rank, and a small one
 * is simply harder to recognise. This is the size a major figure had when
 * weight still governed it — the tree lost its smallest faces, not its
 * largest.
 */
export const FACE = 118;

/**
 * The band every node reserves for its portrait, and the axis the circles are
 * hung from — measured down from the top of the node box.
 *
 * Kept as its own name although it now equals `FACE`: the axis is what makes a
 * generation read as a line, and the drawing code asks for it by meaning
 * rather than by coincidence. The `+` that closes a row is centred on it too,
 * so the invitation sits among the faces and not above or below them.
 */
export const FACE_BAND = FACE;
export const FACE_AXIS = FACE_BAND / 2;

/**
 * A node's box — the card, and the portrait that overflows above it.
 *
 * Wide enough that the card shows on either side of the face rather than being
 * hidden behind it, and tall enough to hold a name on two lines plus dates.
 * Fixed for everyone, because the connectors attach to the box.
 */
export const NODE = { width: 152, height: 186 };

/**
 * Where the card begins, measured from the top of the box: halfway down the
 * portrait, which is what makes the face read as resting *on* the card rather
 * than inside it.
 */
export const CARD_TOP = FACE / 2;

/**
 * Between two nodes of the same generation, and between two generations.
 *
 * The vertical gap is only what the elbow needs: a taller one pushed the
 * generations apart until a grandparent and a grandchild could not be seen at
 * once, which is the one thing a genealogy is for.
 *
 * It is also smaller than it looks, because the portrait of the row below
 * overflows *upwards* out of its card: half a face — 59 points — already
 * reaches into this gap. What separates two cards is therefore 36 points, and
 * what separates a card from the face beneath it is the 36 written here.
 */
export const GAP = { x: 16, y: 36 };

export const PADDING = 24;

export type Placed = { member: TreeMember; x: number; y: number };

/**
 * A piece of a connector. Always axis-aligned — see `connectors`.
 *
 * `left`/`top` and not `x`/`y`, because this object is handed straight to a
 * style: React Native has no `x` or `y`, and ignores them in silence. The
 * first version used them and drew every segment stacked in the corner.
 */
export type Segment = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const STROKE = 2;

/**
 * The rows the canvas draws, from top to bottom.
 *
 * Always one empty row beyond the members at each end: that is where the `+`
 * for an earlier or a later generation lives, and making it a real row rather
 * than a floating button is what lets one rule place every slot.
 *
 * **Generations are signed**, and that is the point. Adding a generation above
 * the first would otherwise mean renumbering every member in the tree; here it
 * is one row at −1, and the frame does the shifting at drawing time.
 */
export type Frame = { from: number; to: number };

export function frame(tree: Tree): Frame {
  if (tree.members.length === 0) return { from: 0, to: 0 };
  const rows = tree.members.map((member) => member.generation);
  return { from: Math.min(...rows) - 1, to: Math.max(...rows) + 1 };
}

/**
 * The columns the canvas draws, left to right.
 *
 * **Positions are signed too, and sparse.** A reader arranging a tree wants to
 * push someone left to line them up under their parents, and to leave a hole
 * where nobody belongs — so positions are neither renumbered to close gaps nor
 * kept above zero. Pushing left from the leftmost column simply reaches −1,
 * and this frame does the shifting at drawing time, exactly as `frame` does
 * for generations. Nobody else has to move for one person to move.
 *
 * One spare column on the right, where the `+` that closes a row lives.
 */
export function span(tree: Tree): Frame {
  if (tree.members.length === 0) return { from: 0, to: 0 };
  const columns = tree.members.map((member) => member.position);
  return { from: Math.min(...columns), to: Math.max(...columns) + 1 };
}

export const rowY = (generation: number, within: Frame): number =>
  PADDING + (generation - within.from) * (NODE.height + GAP.y);

export const columnX = (position: number, across: Frame): number =>
  PADDING + (position - across.from) * (NODE.width + GAP.x);

/**
 * The column a point on the canvas falls in — `columnX` read backwards.
 *
 * Rounded rather than floored, so a card released anywhere in a column's
 * half-width lands in it: a finger is not precise, and the nearest column is
 * always what was meant.
 */
export const columnAt = (x: number, across: Frame): number =>
  across.from + Math.round((x - PADDING) / (NODE.width + GAP.x));

/** How many members stand in a given row. */
export const rowCount = (tree: Tree, generation: number): number =>
  tree.members.filter((member) => member.generation === generation).length;

/**
 * The column where a row's `+` sits: just past its rightmost member.
 *
 * Past the *position*, not past the count — with gaps allowed, a row of three
 * can perfectly well end at column 7.
 */
export function nextColumn(tree: Tree, generation: number): number {
  const row = tree.members.filter((member) => member.generation === generation);
  if (row.length === 0) return span(tree).from;
  return Math.max(...row.map((member) => member.position)) + 1;
}

/**
 * Where every member sits on the canvas.
 *
 * A generation is a row and a position is a column, so the arithmetic is
 * trivial — which is the point. A genealogy that computed its own aesthetic
 * layout would fight the reader who is arranging it by hand, and arranging it
 * by hand is the whole feature.
 */
export function place(tree: Tree): Placed[] {
  const within = frame(tree);
  const across = span(tree);
  return tree.members.map((member) => ({
    member,
    x: columnX(member.position, across),
    y: rowY(member.generation, within),
  }));
}

/**
 * Big enough for the members **and** for the slot that closes each row — the
 * canvas must be scrollable to what it offers, not only to what it holds.
 */
export function canvasSize(tree: Tree): { width: number; height: number } {
  const within = frame(tree);
  const across = span(tree);
  return {
    // `across.to` is already one past the rightmost member — the slot's column.
    width: columnX(across.to, across) + NODE.width + PADDING,
    height: rowY(within.to, within) + NODE.height + PADDING,
  };
}

/**
 * Every line in the tree, as axis-aligned rectangles.
 *
 * Rectangles because React Native draws no diagonals without a native module —
 * and because a genealogy is drawn with set squares anyway. Three shapes:
 *
 * - **couple**: a single bar between the two portraits, on the axis the faces
 *   are hung from. It never crosses a stranger, because a couple is kept
 *   standing together in its row (`events/rows.ts`).
 * - **descent from one parent**: an elbow leaving the bottom of their box,
 *   running across at mid-gap, and dropping into the child. Where a parent has
 *   several children the first segments coincide and read as one trunk.
 * - **descent from two**: the same elbow, but leaving the **middle of their
 *   marriage bar** rather than either of them — which is how a genealogist
 *   draws a child of the couple, and the only honest way to say that the child
 *   belongs to both. The run still sits at mid-gap, so it lines up with every
 *   other family on the row.
 */
export function connectors(tree: Tree, placed: Placed[]): Segment[] {
  const at = new Map(placed.map((node) => [node.member.id, node]));
  const out: Segment[] = [];

  for (const link of tree.links) {
    if (link.kind !== "couple") continue;
    const bar = marriage(at.get(link.from), at.get(link.to));
    if (bar) {
      out.push({
        left: bar.from,
        top: bar.y - STROKE / 2,
        width: Math.max(bar.to - bar.from, STROKE),
        height: STROKE,
      });
    }
  }

  for (const [childId, parentIds] of parentage(tree)) {
    const child = at.get(childId);
    if (!child) continue;

    const drawn = new Set<string>();
    for (const parentId of parentIds) {
      if (drawn.has(parentId)) continue;
      const parent = at.get(parentId);
      if (!parent) continue;
      drawn.add(parentId);

      // Both parents of this child, married to each other: one line for the
      // two of them, from the middle of what marries them.
      const mateId = parentIds.find(
        (other) =>
          other !== parentId && !drawn.has(other) && married(tree, parentId, other),
      );
      const bar = mateId ? marriage(parent, at.get(mateId)) : null;
      if (mateId && bar) drawn.add(mateId);

      const start = bar
        ? { x: (bar.from + bar.to) / 2, y: bar.y }
        : { x: parent.x + NODE.width / 2, y: parent.y + NODE.height };
      const to = { x: child.x + NODE.width / 2, y: child.y };
      // Measured from the foot of the row and not from the start, so a line
      // dropping from a marriage bar crosses the gap at the same height as one
      // leaving a single parent's box.
      const mid = parent.y + NODE.height + (to.y - parent.y - NODE.height) / 2;

      out.push({
        left: start.x - STROKE / 2,
        top: start.y,
        width: STROKE,
        height: Math.max(mid - start.y, 0),
      });
      out.push({
        left: Math.min(start.x, to.x) - STROKE / 2,
        top: mid - STROKE / 2,
        width: Math.abs(to.x - start.x) + STROKE,
        height: STROKE,
      });
      out.push({
        left: to.x - STROKE / 2,
        top: mid,
        width: STROKE,
        height: Math.max(to.y - mid, 0),
      });
    }
  }
  return out;
}

/** Every child of the tree, with the parents claimed for them. */
function parentage(tree: Tree): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const link of tree.links) {
    if (link.kind !== "descent") continue;
    const parents = out.get(link.to) ?? [];
    parents.push(link.from);
    out.set(link.to, parents);
  }
  return out;
}

const married = (tree: Tree, a: string, b: string): boolean =>
  tree.links.some(
    (link) =>
      link.kind === "couple" &&
      ((link.from === a && link.to === b) || (link.from === b && link.to === a)),
  );

/**
 * Where the bar between two spouses runs: from the edge of one face to the edge
 * of the other, on the axis they are both hung from.
 *
 * `null` when they do not share a row. Nothing in the app draws such a link,
 * but a hand-edited database must not turn an equals sign into a diagonal.
 */
function marriage(
  a: Placed | undefined,
  b: Placed | undefined,
): { from: number; to: number; y: number } | null {
  if (!a || !b || a.member.generation !== b.member.generation) return null;
  const [left, right] = a.x <= b.x ? [a, b] : [b, a];
  return {
    from: left.x + NODE.width / 2 + FACE / 2,
    to: right.x + NODE.width / 2 - FACE / 2,
    y: left.y + FACE_AXIS,
  };
}

/** How many generations actually hold someone. */
export function generationCount(tree: Tree): number {
  const rows = new Set(tree.members.map((member) => member.generation));
  return rows.size;
}
