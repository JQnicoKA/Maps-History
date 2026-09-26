import * as Haptics from "expo-haptics";

/**
 * The small taps the phone gives back, when a gesture crosses a threshold the
 * eye has not caught up with yet.
 *
 * Kept to two, and used sparingly. A device that buzzes at every touch teaches
 * the reader to ignore it, which costs the one moment where it mattered.
 *
 * **Every call is swallowed on failure.** The module is native, so on a build
 * that predates it — or a device with no Taptic Engine, or a reader who turned
 * the feature off — the promise rejects. A missing tap is a missing nicety,
 * never a missing gesture, so nothing here is allowed to surface.
 */

/** A card has come loose and now follows the finger. */
export function lifted(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/**
 * The thing being dragged has moved to a new slot.
 *
 * Lighter than the lift on purpose: this one fires a dozen times in a single
 * drag, and at the same weight it would turn into a rattle.
 */
export function shifted(): void {
  void Haptics.selectionAsync().catch(() => {});
}
