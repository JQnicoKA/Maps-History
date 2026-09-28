import { useEffect, useState } from "react";

/**
 * Keeps the last real value, so a panel can finish leaving.
 *
 * A sheet told to close by having its subject taken away — `person={null}`,
 * `target={null}` — has nothing left to draw, returns null, and is torn out of
 * the tree on the spot. No slide down, and worse, no `onClosed`: the one
 * signal a caller needs before raising the next panel, because iOS refuses to
 * present from a controller that is still dismissing.
 *
 * Holding the departed value lets the panel go on drawing what it was drawing
 * while it travels off the screen. The caller passes `visible={value !== null}`
 * and reads the content from here.
 */
export function useLingering<T>(value: T | null): T | null {
  const [kept, setKept] = useState<T | null>(value);

  useEffect(() => {
    if (value !== null) setKept(value);
  }, [value]);

  return value ?? kept;
}
