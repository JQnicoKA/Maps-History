/**
 * The arithmetic of looking at a big drawing through a small window.
 *
 * Pure, and kept apart from the gesture that drives it: the hard part of a
 * pan-and-zoom surface is never the touch handling, it is agreeing on where the
 * content is allowed to sit. Everything here is in screen points, with the
 * origin at the top-left of the window, so a content point `p` is drawn at
 * `offset + p * scale`.
 */

export type Size = { width: number; height: number };
export type Offset = { x: number; y: number };
export type View = { scale: number; offset: Offset };

/** The floating bars at the top and bottom eat into the window. */
export type Inset = { top: number; bottom: number };

/**
 * How far the reader may zoom.
 *
 * The floor is low enough for a wide tree to be taken in at a glance — the
 * names have long stopped being readable by then, but the shape of the family
 * is the thing one is looking at. The ceiling is generous because a portrait
 * examined closely is a fair thing to want.
 */
export const SCALE = { min: 0.25, max: 2.5 } as const;

/** Breathing room kept around the drawing when it is framed to fit. */
export const MARGIN = 16;

export const clampScale = (scale: number): number =>
  Math.min(SCALE.max, Math.max(SCALE.min, scale));

/**
 * Where the content may sit, given how big it is drawn.
 *
 * Two rules, and the second is the one that matters. If the drawing is larger
 * than the window it may be dragged, but not past its own edges — a canvas that
 * can be flung into empty space loses the reader. If it is smaller it is
 * centred instead of pinned to a corner, because a small tree floating in the
 * middle of the page reads as finished, and one stuck at the top-left reads as
 * broken.
 */
export function clampOffset(
  view: View,
  content: Size,
  window: Size,
  inset: Inset,
): Offset {
  const drawn = {
    width: content.width * view.scale,
    height: content.height * view.scale,
  };
  const top = inset.top;
  const bottom = window.height - inset.bottom;

  return {
    x: within(view.offset.x, 0, window.width, drawn.width),
    y: within(view.offset.y, top, bottom, drawn.height),
  };
}

function within(value: number, from: number, to: number, length: number): number {
  const room = to - from;
  if (length <= room) return from + (room - length) / 2;
  return Math.min(from, Math.max(to - length, value));
}

/**
 * Zoom by `factor`, keeping whatever is under `focal` exactly where it is.
 *
 * That fixed point is the whole illusion of a pinch: the fingers stay on the
 * face they grabbed. It falls out of solving `focal = offset + p * scale` for
 * the new offset once `p` is known.
 */
export function zoomAround(view: View, focal: Offset, factor: number): View {
  const scale = clampScale(view.scale * factor);
  // The applied ratio, not the asked one — at the stops the content must not
  // drift sideways while the fingers keep spreading.
  const k = scale / view.scale;
  return {
    scale,
    offset: {
      x: focal.x - (focal.x - view.offset.x) * k,
      y: focal.y - (focal.y - view.offset.y) * k,
    },
  };
}

/**
 * The whole drawing, centred, at the largest scale that shows all of it.
 *
 * Never enlarged past life size: a tree of two people blown up to fill the
 * screen looks like a mistake, and leaves nowhere to grow into. A tree too wide
 * to fit even at the floor opens at the floor, and is panned like any other.
 */
export function fit(content: Size, window: Size, inset: Inset): View {
  const room = {
    width: window.width - 2 * MARGIN,
    height: window.height - inset.top - inset.bottom - 2 * MARGIN,
  };
  if (content.width <= 0 || content.height <= 0 || room.width <= 0 || room.height <= 0) {
    return { scale: 1, offset: { x: 0, y: inset.top } };
  }

  const scale = clampScale(
    Math.min(1, room.width / content.width, room.height / content.height),
  );
  const view = { scale, offset: { x: 0, y: 0 } };
  return { scale, offset: clampOffset(view, content, window, inset) };
}
