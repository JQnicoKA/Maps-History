import {
  IMPORTANCE_ORDER,
  type EventFilters,
  type HistoricalEvent,
  type Importance,
} from "./types";

function highest(links: { importance: Importance }[]): Importance {
  return links.reduce<Importance>(
    (best, link) =>
      IMPORTANCE_ORDER[link.importance] > IMPORTANCE_ORDER[best]
        ? link.importance
        : best,
    "low",
  );
}

/**
 * How important an event is *in the current view*: the highest importance it
 * carries among the selected folders, or among all of them when nothing is
 * selected. An event major to one subject should not be drawn as minor because
 * it is incidental to another.
 */
export function effectiveImportance(
  event: HistoricalEvent,
  filters: EventFilters,
): Importance {
  if (filters.folders.length === 0) return highest(event.folders);

  const inScope = event.folders.filter((link) =>
    filters.folders.some((filter) => filter.folderId === link.folderId),
  );
  return highest(inScope.length > 0 ? inScope : event.folders);
}

/**
 * Folders are a union: picking two subjects shows the events of either. Within
 * one folder line, an importance narrows it further.
 */
export function matchesFilters(
  event: HistoricalEvent,
  filters: EventFilters,
): boolean {
  if (filters.folders.length === 0) return true;

  return filters.folders.some((filter) => {
    const link = event.folders.find((l) => l.folderId === filter.folderId);
    if (!link) return false;
    return filter.importance === null || link.importance === filter.importance;
  });
}
