import type { HistoricalDate, Importance, TreeBond } from "../events/types";

/**
 * What kind of thing a page of the catalogue is about.
 *
 * Tous se dessinent et se cherchent pareil — un nom, une période, un lieu, un
 * nombre de copies — donc un seul panneau les liste tous et ceci dit à quelle
 * porte frapper. Seuls la vignette et la ligne sous le titre diffèrent, et ce
 * sont deux fonctions, pas deux écrans.
 *
 * **Les villes et les territoires n'en sont pas**, et ne l'ont été qu'un
 * jour. Ce sont les deux seuls genres qui possèdent déjà un fond partagé par
 * tout le monde — `places` et `polities` — alors un conservateur les y
 * promeut au lieu de les publier dans une bibliothèque où l'on viendrait les
 * copier. Rien à chercher, rien à copier : tout le monde les a. Voir
 * `promote_place` et `promote_polity`.
 *
 * Une union discriminée plutôt qu'une chaîne : ajouter un genre ici fait
 * lister par le compilateur tout ce qui reste à compléter, ce qui est la
 * seule manière sûre d'en ajouter un.
 */
export type Kind = "event" | "character" | "folder" | "tree";

/**
 * One line of the community catalogue.
 *
 * Deliberately not an `EventSummary`: it is somebody else's row, it carries
 * things a summary never has — a count of copies, whether this
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
  /**
   * The one extra fact a kind has to offer, or null.
   *
   * A classeur says how many events come with it, which is what a reader
   * needs before taking a whole subject; a tree will say how many people
   * across how many generations. Events and people have nothing to add.
   */
  note: string | null;
  /** Birth and death for a person, start and end for an event: one span. */
  start: HistoricalDate | null;
  end: HistoricalDate | null;
  /** Null for the people written down before the map knew about them. */
  longitude: number | null;
  latitude: number | null;
  /** Ready to put in an Image, or null. */
  cover: string | null;
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
  /**
   * A coarse outline, for the kinds that are one — a painted territory.
   *
   * It rides along in the list because it is that kind's only picture, and
   * because a tap on it goes straight to the map: without the shape in hand
   * that would cost a second query before anything could be shown.
   */
  shape?: unknown;
};

/** What the card shows before anybody decides to copy it. */
export type SharedThingDetail = SharedThing & {
  description: string | null;
  photos: { url: string; source: string | null }[];
  /**
   * Who or what it names, whose meaning depends on the kind: for an event,
   * its cast; for a person, the events that mention them. Names only — the
   * reader will never hold these rows.
   */
  cast: string[];
  /**
   * What its author filed it under, and whichever of those can be opened.
   *
   * For an event these are classeurs, and `thing` carries each one whole, so
   * the card can offer a way in: a reader who arrived at one event may well
   * want the whole box, and a list of names was a dead end. For a person
   * these are the author's trees, and `thing` is null — a tree is read on a
   * canvas, not in a card.
   *
   * Private filing is absent rather than named: withdrawing a classeur from
   * the community promises it belongs to its author alone.
   */
  folders: { name: string; thing: SharedThing | null }[];
  /**
   * What this one holds, in the catalogue's own row shape.
   *
   * A classeur's events, drawn with the very line the search draws — a list
   * of titles said nothing a reader could judge a box by. Empty for the
   * kinds that hold nothing.
   */
  held: SharedThing[];
  /**
   * A GeoJSON geometry, for the kinds that are one — a painted territory.
   *
   * Null for the rest. It is never drawn on the card: an outline means
   * nothing away from the coastlines it was painted over, so the card sends
   * the reader to the map instead.
   */
  shape: unknown | null;
  /**
   * A whole genealogy, for the kinds that are one.
   *
   * Members, lines and faces — what the canvas needs and nothing else. Null
   * for the rest. Like a territory's outline it is never drawn on the card:
   * a lineage of forty has no business in a panel.
   */
  drawing: {
    members: {
      id: string;
      /** Null sur une étiquette, qui est un écrit et non quelqu'un. */
      characterId: string | null;
      text: string | null;
      width: number;
      generation: number;
      position: number;
      importance: Importance;
    }[];
    links: { from: string; to: string; kind: TreeBond }[];
    people: {
      id: string;
      name: string;
      photo: string | null;
      dates: string;
      /** The dominant colour of their first portrait, `#rrggbb`, or null. */
      tint: string | null;
    }[];
  } | null;
};

/**
 * How the catalogue is ordered.
 *
 * Two, and the database knows a third — by nearness — which the panel does
 * not offer. Ordering by distance and *filtering* by region answer the same
 * wish, and the filter answers it better: "what is there, around here" is a
 * question about what to show, not about what to show first.
 */
export type Ordering = "stars" | "recent";

export type Search = {
  words: string;
  /**
   * The era, as the reader states it: a date, and how far either side of it.
   *
   * A centre and a width rather than two bounds, because that is the shape of
   * the question — "around the 14th of July 1789, give or take a week" — and
   * because it lets the two be changed one at a time. The bounds the database
   * wants are worked out when the question is asked; see `period.ts`, which
   * also decides which widths a date of that precision deserves.
   *
   * A null width means every century, whatever date is in the wheels.
   */
  at: HistoricalDate | null;
  span: number | null;
  /**
   * Where to look, and how far — both or neither, and both chosen on the map
   * itself, where the circle can be seen.
   */
  near: { longitude: number; latitude: number } | null;
  withinMetres: number | null;
  sort: Ordering;
};

export const ANYTHING: Search = {
  words: "",
  at: null,
  span: null,
  near: null,
  withinMetres: null,
  sort: "stars",
};

/** Where the last page stopped, handed back for the next one. */
export type Cursor = { rank: number; id: string } | null;

/** Why something should not be in the community. */
export const REASONS = [
  { value: "offensive" as const, label: "Contenu choquant ou haineux" },
  { value: "wrong" as const, label: "Faux ou trompeur" },
  { value: "spam" as const, label: "Indésirable ou publicitaire" },
  { value: "stolen" as const, label: "Copié sans autorisation" },
  { value: "other" as const, label: "Autre" },
];

export type Reason = (typeof REASONS)[number]["value"];

/** What a kind looks like, which is all that differs between the four. */
export type Look = {
  /** "Bibliothèque", and what one of them is called on its own. */
  many: string;
  one: string;
  /** Stands in for a missing picture — an emoji, an initial. */
  glyph: (thing: SharedThing) => string;
  /** The line under the title: a period, a lifespan, a reign. */
  under: (thing: SharedThing) => string;
  /**
   * What the search field asks for — "Nom du personnage", not "Nom".
   *
   * The panel is one screen reused five times, and "Nom" was the price of
   * that: a reader arriving from the Territoires button saw a field that
   * could have belonged to anything. Rendered in small capitals by
   * `InkField`, so it is written here in sentence case.
   */
  named: string;
  /**
   * Three examples in the empty field, in this kind's own vocabulary.
   *
   * A placeholder's one job is to say what sort of word is expected, and
   * "Marignan, sacre, traité…" does that for events and misleads everywhere
   * else. Real names rather than invented ones: they also tell a reader that
   * the catalogue is not only French.
   */
  hint: string;
  /** What the two name lists mean for this kind. */
  /**
   * True when a tap belongs on the map rather than on a card.
   *
   * A territory is its outline: a card can name it and measure it, and say
   * nothing about the one thing the reader wants to know. So the row skips
   * the card and lays the shape on the plate.
   */
  onTheMap?: boolean;
  castLegend: string;
  castAside: string;
  filedLegend: string;
  filedAside: string;
  /**
   * The button beside each thing it is filed under — "Voir le classeur",
   * "Voir l'arbre".
   *
   * Empty for the kinds whose filing leads nowhere. Blank here and a null
   * `thing` in the payload say the same thing from the two ends, and the card
   * needs **both** to agree before it draws a way in — which is why opening
   * this door for a kind means touching the SQL door as well.
   */
  filedDoor: string;
  /**
   * What kind that door leads to: a classeur from an event, an arbre from a
   * person.
   *
   * Absent wherever `filedDoor` is empty. Named here rather than guessed by
   * the panel, which would otherwise hold a list of which kind files under
   * which — a second place to keep in step with this one.
   */
  filedKind?: Kind;
  /**
   * The button that takes it — "Copier l'événement", not "Copier".
   *
   * The catalogue is a place one wanders: a list, a classeur, one of its
   * events, the classeur that event was also filed in. Four panels deep, a
   * button saying only "Copier" leaves the reader to remember which of the
   * four they are standing in, and a wrong guess costs them a copy they did
   * not want. Naming the thing is the cheapest possible map. Written out per
   * kind rather than built from `one`, because the elision differs.
   */
  take: string;
  /**
   * La question posée avant de copier — « Copier cet événement ? »
   *
   * Écrite par genre plutôt que construite depuis `one`, pour la même raison
   * que `take` : l'élision diffère, et « cet arbre » contre « ce classeur »
   * ne se devine pas.
   */
  ask: string;
  /**
   * Ce qui vient **avec** la chose, dit avant de la prendre.
   *
   * Rien d'autre, et c'est une décision : une fenêtre de confirmation répond
   * à « qu'est-ce que j'obtiens en touchant ce bouton », pas « comment cette
   * application fonctionne-t-elle ». Les règles — ce qui reste à la
   * bibliothèque, le fait qu'une copie n'y retourne pas — ont leur place sur
   * les fiches (`castAside`, `filedAside`) et dans `whyLocked`, où le lecteur
   * les rencontre quand elles le concernent.
   */
  means: string;
  nothing: string;
};

