export type Importance = "low" | "medium" | "high";

export type EventType =
  | "birth"
  | "death"
  | "marriage"
  | "coronation"
  | "battle"
  | "conquest"
  | "treaty"
  | "revolution"
  | "independence"
  | "law"
  | "construction"
  | "exploration"
  | "discovery"
  | "culture"
  | "disaster"
  | "other";

/**
 * The vocabulary, in the order it is offered. The emoji is for the picker and
 * the cards; the map draws the engraved glyph of the same name instead.
 */
export const EVENT_TYPES: { value: EventType; label: string; emoji: string }[] = [
  { value: "birth", label: "Naissance", emoji: "👶" },
  { value: "death", label: "Mort", emoji: "⚰️" },
  { value: "marriage", label: "Mariage", emoji: "💍" },
  { value: "coronation", label: "Couronnement / Sacre", emoji: "👑" },
  { value: "battle", label: "Bataille / Guerre", emoji: "⚔️" },
  { value: "conquest", label: "Conquête / Invasion", emoji: "🏰" },
  { value: "treaty", label: "Traité / Paix", emoji: "🕊️" },
  { value: "revolution", label: "Révolution / Révolte", emoji: "🔥" },
  { value: "independence", label: "Indépendance / Fondation d'État", emoji: "🗺️" },
  { value: "law", label: "Loi / Réforme", emoji: "⚖️" },
  { value: "construction", label: "Construction / Fondation", emoji: "🏗️" },
  { value: "exploration", label: "Exploration / Voyage", emoji: "🧭" },
  { value: "discovery", label: "Découverte / Invention", emoji: "💡" },
  { value: "culture", label: "Culture / Œuvre", emoji: "🎨" },
  { value: "disaster", label: "Catastrophe / Épidémie", emoji: "🌋" },
  { value: "other", label: "Autre", emoji: "🔹" },
];

export function describeType(type: EventType): { label: string; emoji: string } {
  return (
    EVENT_TYPES.find((entry) => entry.value === type) ?? {
      label: "Autre",
      emoji: "🔹",
    }
  );
}

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

/** A photo already stored; the path is what lets us delete it. */
export type EventPhoto = {
  id: string;
  path: string;
  url: string;
};

/** A picture chosen in the picker, not yet uploaded. */
export type PickedPhoto = {
  uri: string;
  base64: string;
  mimeType: string;
};

export type HistoricalEvent = {
  id: string;
  title: string;
  type: EventType;
  description: string | null;
  start: HistoricalDate;
  /** Present for events that span time — a war, a reign. */
  end: HistoricalDate | null;
  longitude: number;
  latitude: number;
  folders: EventFolderLink[];
  photos: EventPhoto[];
};

export type EventDraft = {
  title: string;
  type: EventType;
  description: string;
  start: HistoricalDate;
  end: HistoricalDate | null;
  longitude: number;
  latitude: number;
  folders: EventFolderLink[];
  /** Pictures to upload. On an edit, only the newly added ones. */
  photos: PickedPhoto[];
};

/** One line of the filter popup: a folder, and how much it must matter there. */
export type FolderFilter = {
  folderId: string;
  /** `null` means every importance — the default. */
  importance: Importance | null;
};

export type EventFilters = {
  /** Empty means no filtering at all: every event is shown. */
  folders: FolderFilter[];
};

export const NO_FILTERS: EventFilters = { folders: [] };
