import type { Tree, TreeMember } from "../events/types";

/** A node's box. Wide enough for a face, a name and two dates under it. */
export const NODE = { width: 120, height: 136 };

/**
 * Between two nodes of the same generation, and between two generations.
 *
 * The vertical gap is only what the elbow needs: a taller one pushed the
 * generations apart until a grandparent and a grandchild could not be seen at
 * once, which is the one thing a genealogy is for.
 */
export const GAP = { x: 16, y: 52 };

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

export const rowY = (generation: number, within: Frame): number =>
  PADDING + (generation - within.from) * (NODE.height + GAP.y);

export const columnX = (position: number): number =>
  PADDING + position * (NODE.width + GAP.x);

/** How many members stand in a given row. */
export const rowCount = (tree: Tree, generation: number): number =>
  tree.members.filter((member) => member.generation === generation).length;

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
  return tree.members.map((member) => ({
    member,
    x: columnX(member.position),
    y: rowY(member.generation, within),
  }));
}

/**
 * Big enough for the members **and** for the slot that closes each row — the
 * canvas must be scrollable to what it offers, not only to what it holds.
 */
export function canvasSize(tree: Tree): { width: number; height: number } {
  const within = frame(tree);
  let width = 0;
  for (let row = within.from; row <= within.to; row++) {
    width = Math.max(width, columnX(rowCount(tree, row)) + NODE.width);
  }
  return {
    width: width + PADDING,
    height: rowY(within.to, within) + NODE.height + PADDING,
  };
}

/**
 * The lines from parents to children, as axis-aligned rectangles.
 *
 * Three segments per link — down out of the parent, across, down into the
 * child — because React Native draws no diagonals without a native module, and
 * because an elbow is what a genealogy uses anyway. Where a parent has several
 * children the first segments coincide and read as one trunk, which is exactly
 * the drawing one wants and costs nothing to arrange.
 */
export function connectors(tree: Tree, placed: Placed[]): Segment[] {
  const at = new Map(placed.map((node) => [node.member.id, node]));
  const out: Segment[] = [];

  for (const link of tree.links) {
    const parent = at.get(link.parentId);
    const child = at.get(link.childId);
    if (!parent || !child) continue;

    const from = { x: parent.x + NODE.width / 2, y: parent.y + NODE.height };
    const to = { x: child.x + NODE.width / 2, y: child.y };
    // Halfway down the gap, so siblings share one horizontal run.
    const mid = from.y + (to.y - from.y) / 2;

    out.push({
      left: from.x - STROKE / 2,
      top: from.y,
      width: STROKE,
      height: Math.max(mid - from.y, 0),
    });
    out.push({
      left: Math.min(from.x, to.x) - STROKE / 2,
      top: mid - STROKE / 2,
      width: Math.abs(to.x - from.x) + STROKE,
      height: STROKE,
    });
    out.push({
      left: to.x - STROKE / 2,
      top: mid,
      width: STROKE,
      height: Math.max(to.y - mid, 0),
    });
  }
  return out;
}

/** How many generations actually hold someone. */
export function generationCount(tree: Tree): number {
  const rows = new Set(tree.members.map((member) => member.generation));
  return rows.size;
}
