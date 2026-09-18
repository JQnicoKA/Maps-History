import type { EventSummary, Folder } from "./types";

/**
 * The picture that stands for an event — in its marker on the plate and in its
 * summary tile, which must never disagree.
 *
 * Its own first photograph, failing that the cover of a folder it is filed
 * under, failing both nothing at all: the caller falls back to the type's
 * emoji. When several folders have a cover, the first in the list wins; the
 * list is alphabetical, so the choice is arbitrary but stable, which is all it
 * has to be.
 */
export function coverFor(
  event: EventSummary,
  folders: Folder[],
): string | undefined {
  if (event.cover) return event.cover.url;

  return folders.find(
    (folder) =>
      folder.photo !== null &&
      event.folders.some((link) => link.folderId === folder.id),
  )?.photo?.url;
}
