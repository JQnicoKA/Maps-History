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
  { value: "other", label: "Autre", emoji: "📎" },
];

export function describeType(type: EventType): { label: string; emoji: string } {
  return (
    EVENT_TYPES.find((entry) => entry.value === type) ?? {
      label: "Autre",
      emoji: "📎",
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
  /**
   * The date is a best guess — "around 1453" rather than 1453.
   *
   * Carried on the date and not on the thing dated: an event can begin on a
   * known day and end at an approximate one, and a life can have a guessed
   * birth and an attested death.
   */
  approximate?: boolean;
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

/**
 * An event as the map, the frieze and the list need it — and no more.
 *
 * Every event of the collection is held in memory at once: the frieze marks
 * them all across five millennia, the two arrows walk the whole ordered list,
 * and the markers are drawn from it. What can be left out is what only one
 * open event needs — its text, and every picture but the first. On a
 * collection of a few thousand that is the difference between six megabytes
 * and two.
 */
export type EventSummary = {
  id: string;
  title: string;
  type: EventType;
  start: HistoricalDate;
  /** Present for events that span time — a war, a reign. */
  end: HistoricalDate | null;
  longitude: number;
  latitude: number;
  folders: EventFolderLink[];
  /** Identifiers of the people this event is about. */
  characters: string[];
  /** The first picture, which is all the marker and the card ever show. */
  cover: StoredPhoto | null;
};

/**
 * One event, whole — read when a reader opens it.
 *
 * It **extends** the summary rather than standing beside it, and that is the
 * point: a full event goes wherever a summary is expected, while a summary is
 * refused where the whole thing is required. The form that saves an event
 * cannot be handed one picture out of five and write the other four away,
 * because the compiler will not let it.
 */
export type HistoricalEvent = EventSummary & {
  description: string | null;
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
  note: string | null;
};

/**
 * What a line between two members means.
 *
 * Two, and the geometry follows from them: **descent** runs down a generation
 * and is drawn as an elbow, **couple** runs across one and is drawn as the
 * equals sign a genealogist would pencil between two spouses.
 */
export const BONDS = ["descent", "couple"] as const;
export type TreeBond = (typeof BONDS)[number];

/**
 * A line between two members of one tree.
 *
 * `from` and `to` rather than parent and child, because only half the lines
 * have a parent: on a couple the pair is symmetrical and `from` is merely
 * whoever was touched first. For a descent, `from` is the parent.
 */
export type TreeLink = { kind: TreeBond; from: string; to: string };

/** Where a member is to stand, once a row has been rearranged. */
export type Move = { id: string; position: number };

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
