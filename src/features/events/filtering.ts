import {
  IMPORTANCE_ORDER,
  type EventFilters,
  type HistoricalEvent,
  type Importance,
} from "./types";

/**
 * How important an event is *in the current view*. With a folder selected that
 * is the importance it carries in that folder; with no folder it is the highest
 * importance it carries anywhere — an event major to one subject should not be
 * drawn as minor just because it is incidental to another.
 */
export function effectiveImportance(
  event: HistoricalEvent,
  folderId: string | null,
): Importance {
  if (folderId !== null) {
    return (
      event.folders.find((link) => link.folderId === folderId)?.importance ??
      "medium"
    );
  }
  return event.folders.reduce<Importance>(
    (highest, link) =>
      IMPORTANCE_ORDER[link.importance] > IMPORTANCE_ORDER[highest]
        ? link.importance
        : highest,
    "low",
  );
}

export function matchesFilters(
  event: HistoricalEvent,
  { folderId, importance }: EventFilters,
): boolean {
  if (folderId !== null && !event.folders.some((l) => l.folderId === folderId)) {
    return false;
  }
  if (importance !== null && effectiveImportance(event, folderId) !== importance) {
    return false;
  }
  return true;
}
