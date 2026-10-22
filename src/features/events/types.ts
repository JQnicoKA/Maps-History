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
  { value: "coronation", label: "Sacre", emoji: "👑" },
  { value: "battle", label: "Bataille", emoji: "⚔️" },
  { value: "conquest", label: "Conquête", emoji: "🏰" },
  { value: "treaty", label: "Traité", emoji: "🕊️" },
  { value: "revolution", label: "Révolte", emoji: "🔥" },
  { value: "independence", label: "Fondation d'État", emoji: "🗺️" },
  { value: "law", label: "Loi", emoji: "⚖️" },
  { value: "construction", label: "Construction", emoji: "🏗️" },
  { value: "exploration", label: "Exploration", emoji: "🧭" },
  { value: "discovery", label: "Découverte", emoji: "💡" },
  { value: "culture", label: "Culture", emoji: "🎨" },
  { value: "disaster", label: "Catastrophe", emoji: "🌋" },
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
  /**
   * The dominant colour of the picture, `#rrggbb`, computed once when it was
   * uploaded — see the `tint` Edge Function and `inWax` in the theme.
   *
   * Null for three different reasons, and nothing downstream needs to tell
   * them apart: nobody has looked yet, the picture had no colour in it (a
   * daguerreotype, a pencil drawing), or it is an event's photograph rather
   * than a portrait. **Only portraits carry one today** — the column exists on
   * `character_photos` alone, because a tree card is the only thing that has
   * asked for it. Giving events theirs is a column and one line here.
   */
  tint: string | null;
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
  /**
   * Quand cette ligne a été écrite, telle que la base la date.
   *
   * Elle n'a rien d'historique — c'est la date du geste, pas celle du fait —
   * et elle ne sert qu'à répondre « le plus récemment touché » : le tri des
   * classeurs s'en sert pour les ranger par dernier emploi. Rien ne
   * l'affiche.
   */
  createdAt: string;
  title: string;
  type: EventType;
  start: HistoricalDate;
  /** Present for events that span time — a war, a reign. */
  end: HistoricalDate | null;
  longitude: number;
  latitude: number;
  /**
   * Les sujets sous lesquels il est rangé, par leur nom.
   *
   * Des noms et non pas des identifiants, parce qu'un classeur n'est rien de
   * plus : il n'a ni ligne, ni photographie, ni auteur. Ce que cela gagne, en
   * plus d'une table et de trois fonctions, c'est que le classement **part
   * avec la copie** — qui prend trois événements carolingiens les reçoit
   * groupés, là où un classeur-entité restait chez son auteur.
   *
   * La liste des noms connus se déduit de la collection ; voir
   * `folderNames` dans `EventsProvider`.
   */
  folders: string[];
  /**
   * Combien il compte, pour celui qui l'a écrit.
   *
   * Portée par l'événement et non par le couple (événement, classeur) :
   * « majeur ici, incident là » était possible, n'est jamais arrivé une fois,
   * et la fonction écrite pour ce cas n'avait aucun appelant hors de son
   * test.
   */
  importance: Importance;
  /**
   * Proposé à la bibliothèque, qui le reprendra si elle le vérifie.
   *
   * True unless the reader said otherwise: what is written here is history,
   * and history nobody shares is history nobody reads. The way out exists for
   * the reader writing their own family rather than the world's.
   */
  shared: boolean;
  /**
   * The row this was taken from, in another account — null for an original.
   *
   * What it is for today is telling the truth when something is deleted: a
   * copy's disappearance costs nothing, since the entry it was taken from
   * still stands in the library, and saying "c'est définitif" over a copy is
   * a lie.
   */
  origin: string | null;
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
  /**
   * Ce que ce personnage pèse, pour celui qui l'a écrit.
   *
   * Le pendant exact de celle d'un événement, et réglée au même endroit :
   * dans le formulaire, une fois pour toutes. Les arbres s'en servent pour
   * le poids du nœud — un majeur se détache, un discret s'efface — et ne
   * l'offrent plus à régler chez eux : on ne décide pas de ce que quelqu'un
   * vaut dessin par dessin.
   */
  importance: Importance;
  /**
   * Quand cette ligne a été écrite, telle que la base la date.
   *
   * Elle n'a rien d'historique — c'est la date du geste, pas celle du fait —
   * et elle ne sert qu'à répondre « le plus récemment touché » : le tri des
   * classeurs s'en sert pour les ranger par dernier emploi. Rien ne
   * l'affiche.
   */
  createdAt: string;
  name: string;
  bio: string | null;
  birth: HistoricalDate | null;
  death: HistoricalDate | null;
  /**
   * Where they stand on the plate, from their birth to their death.
   *
   * Null only for the people written down before the map knew about them: the
   * form now asks for a point, and refuses to save a person without one. They
   * are simply absent from the map until someone opens their card and says
   * where they were.
   */
  longitude: number | null;
  latitude: number | null;
  /**
   * Les sujets sous lesquels il est rangé, par leur nom.
   *
   * **Les mêmes classeurs que les événements**, et c'est le point : un sujet
   * n'est qu'un nom, donc rien n'empêche une bataille et le général qui l'a
   * menée de partager « Révolution française ». Les ranger séparément aurait
   * demandé à l'un des deux de porter une table, et au lecteur de tenir deux
   * listes de sujets qui se ressemblent.
   *
   * La liste des noms connus se déduit des deux collections à la fois ; voir
   * `folderNames` dans `EventsProvider`.
   */
  folders: string[];
  /**
   * Proposé à la bibliothèque, qui le reprendra si elle le vérifie.
   *
   * True unless the reader said otherwise: what is written here is history,
   * and history nobody shares is history nobody reads. The way out exists for
   * the reader writing their own family rather than the world's.
   */
  shared: boolean;
  /**
   * The row this was taken from, in another account — null for an original.
   *
   * What it is for today is telling the truth when something is deleted: a
   * copy's disappearance costs nothing, since the entry it was taken from
   * still stands in the library, and saying "c'est définitif" over a copy is
   * a lie.
   */
  origin: string | null;
  photos: StoredPhoto[];
};

/**
 * Someone's place in one tree.
 *
 * Everything here belongs to the placement, not to the person: the same
 * individual can stand in several trees, and carry a different weight and a
 * different note in each.
 */
export type TreePerson = {
  kind: "person";
  id: string;
  characterId: string;
  generation: number;
  position: number;
  /**
   * Plus d'importance ici, et c'est un déménagement.
   *
   * Elle vivait sur l'appartenance : le même roi pouvait être majeur dans
   * une lignée et discret dans une autre. C'était défendable, et ce n'est
   * plus ce qu'on veut — l'importance dit ce que quelqu'un pèse dans la
   * collection, pas dans un dessin. Elle est donc portée par le personnage,
   * comme celle d'un événement l'est par l'événement, et le nœud la lit
   * là : voir `Character.importance`.
   */
  note: string | null;
};

/** How many columns of the grid an étiquette covers. */
export const LABEL_WIDTHS = [1, 2, 3] as const;
export type LabelWidth = (typeof LABEL_WIDTHS)[number];

/**
 * A few words written on the tree, occupying the grid like a person.
 *
 * What it is for: titling a branch, naming a house, marking the year a line
 * turns. A reading mark, not somebody — which is why it is drawn on paper
 * where a person is drawn in wax, and why it carries no weight: "discret" and
 * "majeur" mean nothing about a piece of writing.
 *
 * **It has no relations, and that is a rule rather than an omission.** A
 * trigger in the database refuses a link that points at one, because a line
 * drawn from a title to a person would be a claim about a filiation that
 * nobody made.
 *
 * It belongs to the tree alone: no dates, no point on the map, and nothing in
 * the Personnages list. Two trees never share one.
 */
export type TreeLabel = {
  kind: "label";
  id: string;
  text: string;
  generation: number;
  position: number;
  width: LabelWidth;
};

/**
 * Whatever stands in a cell of a tree: a person, or a few written words.
 *
 * A discriminated union rather than one shape with optional halves, and the
 * reason is the compiler: every place that reads `characterId` has to say
 * what it does about a label before it will build. On a feature threaded
 * through ten files, that turns an audit into a list.
 */
export type TreeMember = TreePerson | TreeLabel;

/** How many columns this cell covers: one for a person, its width for a label. */
export const columnsOf = (member: TreeMember): number =>
  member.kind === "label" ? member.width : 1;

/**
 * Narrows a width read from the database.
 *
 * A CHECK constraint keeps the column to 1, 2 or 3, but the client receives a
 * plain number — and a row written before that constraint, or by a future
 * version, should land somewhere sane rather than typed as a lie.
 */
export const asLabelWidth = (n: number): LabelWidth =>
  n === 2 || n === 3 ? n : 1;

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
  /**
   * The row this was taken from, in another account — null for an original.
   *
   * What it is for today is telling the truth when something is deleted: a
   * copy's disappearance costs nothing, since the entry it was taken from
   * still stands in the library, and saying "c'est définitif" over a copy is
   * a lie.
   */
  origin: string | null;
  /**
   * Proposé à la bibliothèque, qui le reprendra si elle le vérifie.
   *
   * True unless the reader said otherwise: what is written here is history,
   * and history nobody shares is history nobody reads. The way out exists for
   * the reader writing their own family rather than the world's.
   */
  shared: boolean;

  members: TreeMember[];
  links: TreeLink[];
};

export type CharacterDraft = {
  name: string;
  bio: string;
  /** Ce qu'il pèse, réglé au formulaire — voir `Character.importance`. */
  importance: Importance;
  /** Required by the form: a person with no birth cannot appear anywhere. */
  birth: HistoricalDate | null;
  /** Optional: an unknown death leaves them on the map from their birth on. */
  death: HistoricalDate | null;
  longitude: number | null;
  latitude: number | null;
  /** Les sujets sous lesquels on le range — les mêmes que les événements. */
  folders: string[];
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
  /** Les noms des classeurs, nettoyés par le formulaire : ni vides, ni répétés. */
  folders: string[];
  importance: Importance;
  characters: string[];
  /** Pictures to upload. On an edit, only the newly added ones. */
  photos: PickedPhoto[];
};

/**
 * What the plate is carrying.
 *
 * Three kinds of thing are drawn on the map and each can be put away: the
 * events of the collection, the people who lived through them, and the
 * territories underneath. They were `EventFilters` while events were the only
 * thing one could hide.
 *
 * The folders belong to the events and are ignored while events are hidden —
 * a folder is a way of narrowing what is shown, not a fourth thing to show.
 */
export type MapFilters = {
  events: boolean;
  /**
   * Les classeurs retenus, par leur nom. Vide ne resserre rien.
   *
   * Une réunion : choisir deux sujets montre les événements de l'un **ou** de
   * l'autre.
   */
  folders: string[];
  /**
   * L'importance demandée, ou `null` pour toutes.
   *
   * Un axe à part des classeurs, et c'est ce que le déménagement de
   * l'importance a rendu vrai : elle appartient à l'événement, donc elle se
   * demande une fois et non pas une fois par classeur.
   */
  importance: Importance | null;
  characters: boolean;
  territories: boolean;
};

export const NO_FILTERS: MapFilters = {
  events: true,
  folders: [],
  importance: null,
  characters: true,
  territories: true,
};
