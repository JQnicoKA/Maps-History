import type { HistoricalDate } from "../events/types";

/**
 * What kind of thing a page of the catalogue is about.
 *
 * The five are drawn the same way and searched the same way — a name, a span,
 * a place, an author, a count of stars — so one panel lists them all and this
 * is what tells it which door to knock on. Only the thumbnail and the line
 * under the title differ, and those are two functions, not two screens.
 */
export type Kind = "event" | "character" | "folder" | "tree" | "territory";

/**
 * One line of the community catalogue.
 *
 * Deliberately not an `EventSummary`: it is somebody else's row, it carries
 * things a summary never has — an author, a count of stars, whether this
 * reader already took it — and it lacks things a summary always has, like the
 * folders it is filed under, which are the owner's way of thinking and not
 * ours to display. Two shapes, because they are two different objects.
 */
export type SharedThing = {
  id: string;
  title: string;
  /**
   * What this one is, within its kind: an event's type, and nothing for the
   * rest. The panel hands it to whoever knows how to read it.
   */
  badge: string;
  /** Birth and death for a person, start and end for an event: one span. */
  start: HistoricalDate | null;
  end: HistoricalDate | null;
  /** Null for the people written down before the map knew about them. */
  longitude: number | null;
  latitude: number | null;
  /** Ready to put in an Image, or null. */
  cover: string | null;
  /** The author's pseudonym — never anything else about them. */
  author: string;
  /** How many readers have taken a copy. */
  stars: number;
  mine: boolean;
  copied: boolean;
  /** This reader has already reported it; a second voice is not a second. */
  reported: boolean;
  /**
   * Where this row sits in the current ordering. Handed back with its id to
   * ask for the next page — see `search_events`.
   */
  rank: number;
};

/** What the card shows before anybody decides to copy it. */
export type SharedThingDetail = SharedThing & {
  description: string | null;
  photos: { url: string; source: string | null }[];
  /**
   * Two lists of names, whose meaning depends on the kind: for an event, its
   * cast and the folders its author filed it under; for a person, the events
   * that mention them and the trees they stand in. Names only — the reader
   * will never hold these rows.
   */
  cast: string[];
  folders: string[];
};

/** How the catalogue is ordered. */
export type Ordering = "stars" | "recent" | "near";

export type Search = {
  words: string;
  /** A span to overlap with, or null for every century. */
  from: number | null;
  to: number | null;
  /** Where to look, and how far — both or neither. */
  near: { longitude: number; latitude: number } | null;
  withinMetres: number | null;
  sort: Ordering;
};

export const ANYTHING: Search = {
  words: "",
  from: null,
  to: null,
  near: null,
  withinMetres: null,
  sort: "stars",
};

/** Where the last page stopped, handed back for the next one. */
export type Cursor = { rank: number; id: string } | null;

/** Why something should not be in the chronicle. */
export const REASONS = [
  { value: "offensive" as const, label: "Contenu choquant ou haineux" },
  { value: "wrong" as const, label: "Faux ou trompeur" },
  { value: "spam" as const, label: "Indésirable ou publicitaire" },
  { value: "stolen" as const, label: "Copié sans autorisation" },
  { value: "other" as const, label: "Autre" },
];

export type Reason = (typeof REASONS)[number]["value"];

/** Somebody this reader no longer wishes to see. */
export type Blocked = { id: string; handle: string };
