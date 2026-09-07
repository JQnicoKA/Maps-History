export type Importance = "low" | "medium" | "high";

export const IMPORTANCE_ORDER: Record<Importance, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/**
 * A point in history. `year` is signed — negative years are BC — and month/day
 * are omitted when the source only pins the event down to a year or a month.
 */
export type HistoricalDate = {
  year: number;
  month?: number;
  day?: number;
};

export type Folder = {
  id: string;
  name: string;
};

/** Importance is a property of the event/folder pair, never of the event. */
export type EventFolderLink = {
  folderId: string;
  importance: Importance;
};

export type HistoricalEvent = {
  id: string;
  title: string;
  description: string | null;
  start: HistoricalDate;
  /** Present for events that span time — a war, a reign. */
  end: HistoricalDate | null;
  longitude: number;
  latitude: number;
  folders: EventFolderLink[];
  photoUrls: string[];
};

export type EventDraft = {
  title: string;
  description: string;
  start: HistoricalDate;
  end: HistoricalDate | null;
  longitude: number;
  latitude: number;
  folders: EventFolderLink[];
  /** Local `file://` URIs from the picker, uploaded on save. */
  photos: { uri: string; base64: string; mimeType: string }[];
};

export type EventFilters = {
  folderId: string | null;
  importance: Importance | null;
};

export const NO_FILTERS: EventFilters = { folderId: null, importance: null };
