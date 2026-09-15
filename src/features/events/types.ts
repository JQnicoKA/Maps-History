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
  /**
   * Cover picture. Its one use is the map marker: an event with no photograph
   * of its own borrows its folder's before falling back to the type's emoji.
   */
  photo: { path: string; url: string } | null;
};

/** Importance is a property of the event/folder pair, never of the event. */
export type EventFolderLink = {
  folderId: string;
  importance: Importance;
};

/**
 * A photo already stored; the path is what lets us delete it.
 *
 * Shared by events and characters — the same bucket, the same shape, the same
 * picker. It was `EventPhoto` while events were the only thing that could
 * carry one.
 */
export type StoredPhoto = {
  id: string;
  path: string;
  url: string;
  /** Where the picture came from — a URL or a free-text reference. */
  source: string | null;
};

/** A picture chosen in the picker, not yet uploaded. */
export type PickedPhoto = {
  uri: string;
  base64: string;
  mimeType: string;
  source: string;
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
  /** Identifiers of the people this event is about. */
  characters: string[];
  photos: StoredPhoto[];
};

/**
 * Someone an event was about.
 *
 * Both dates are optional, and each obeys the same rules as an event's: a year
 * on its own is a complete answer, a day needs its month. One knows a name
 * without its dates, and one knows the living.
 */
export type Character = {
  id: string;
  name: string;
  bio: string | null;
  birth: HistoricalDate | null;
  death: HistoricalDate | null;
  photos: StoredPhoto[];
};

/**
 * How a life ended, when it ended early enough to be worth a mark.
 *
 * Deliberately short: a genealogy reads at a glance, and a rail of twenty
 * emoji would turn a signal into a decoration. "Autre" carries the rest, and
 * the member's own note says what it was.
 */
export const TREE_MARKS = [
  { value: "illness", label: "Maladie", emoji: "🤒" },
  { value: "poison", label: "Poison", emoji: "🧪" },
  { value: "murder", label: "Assassinat", emoji: "🗡️" },
  { value: "battle", label: "Bataille", emoji: "⚔️" },
  { value: "execution", label: "Exécution", emoji: "🪓" },
  { value: "accident", label: "Accident", emoji: "⚡" },
  { value: "infancy", label: "En bas âge", emoji: "🕯️" },
  { value: "other", label: "Autre", emoji: "✳️" },
] as const;

export type TreeMark = (typeof TREE_MARKS)[number]["value"];

export function describeMark(
  value: string,
): { label: string; emoji: string } | null {
  return TREE_MARKS.find((mark) => mark.value === value) ?? null;
}

/**
 * Someone's place in one tree.
 *
 * Everything here belongs to the placement, not to the person: the same
 * individual can stand in several trees, and carry a different weight and a
 * different note in each.
 */
export type TreeMember = {
  id: string;
  characterId: string;
  generation: number;
  position: number;
  importance: Importance;
  mark: TreeMark | null;
  note: string | null;
};

/** A line drawn from a parent to a child, both members of the same tree. */
export type TreeLink = { parentId: string; childId: string };

export type Tree = {
  id: string;
  name: string;
  note: string | null;
  members: TreeMember[];
  links: TreeLink[];
};

export type CharacterDraft = {
  name: string;
  bio: string;
  birth: HistoricalDate | null;
  death: HistoricalDate | null;
  /** Pictures to upload. On an edit, only the newly added ones. */
  photos: PickedPhoto[];
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
  characters: string[];
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
