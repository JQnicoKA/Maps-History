import type { Kind, Look } from "./types";
import {
  formatDateYear,
  formatEventPeriod,
  formatYear,
} from "../events/historicalDate";
import { describeType, type EventType } from "../events/types";

/**
 * How each kind of thing reads in the catalogue.
 *
 * Everything else about the panel is the same for all five — the sieve, the
 * paging, the reporting, the blocking — so this is where the differences are
 * kept, and they amount to a glyph, a line, and four labels. Written as data
 * rather than as five screens.
 */

export const EVENT_LOOK: Look = {
  many: "Chronique commune",
  one: "Un événement",
  glyph: (one) => describeType(one.badge as EventType).emoji,
  under: (one) =>
    one.start === null
      ? ""
      : formatEventPeriod({
          start: one.start,
          end: one.end,
        } as Parameters<typeof formatEventPeriod>[0]),
  castLegend: "Personnages",
  castAside: "Ils viendront avec l'événement si vous le copiez.",
  filedLegend: "Rangé par son auteur dans",
  filedAside: "Vos classeurs sont les vôtres : la copie n'en apporte aucun.",
  nothing:
    "Rien de tel dans la chronique. Essayez d'élargir l'époque ou la région — ou écrivez-le vous-même.",
};

/** What a classeur's span reads like: two years, or one, or none at all. */
const span = (one: { start: { year: number } | null; end: { year: number } | null }) => {
  const from = one.start?.year;
  const to = one.end?.year;
  if (from === undefined) return "";
  if (to === undefined || to === from) return formatYear(from);
  return `${formatYear(from)} – ${formatYear(to)}`;
};

export const FOLDER_LOOK: Look = {
  many: "Classeurs de la chronique",
  one: "Un classeur",
  /** No picture and no type: the initial of the subject it gathers. */
  glyph: (one) => one.title.charAt(0).toUpperCase(),
  /**
   * How many events, and the reach of them.
   *
   * The count comes first because it is what decides whether a reader wants
   * the whole box: "27 événements · 481 – 687" says more about a classeur
   * than any description of it would.
   */
  under: (one) => [one.note, span(one)].filter(Boolean).join(" · "),
  castLegend: "Ce qu'il contient",
  castAside:
    "Tous ces événements viendront avec le classeur, et les personnages qu'ils citent avec eux.",
  filedLegend: "",
  filedAside: "",
  nothing:
    "Aucun classeur de ce genre dans la chronique. Essayez d'élargir l'époque ou la région — ou faites le vôtre.",
};

export const CHARACTER_LOOK: Look = {
  many: "Personnages de la chronique",
  one: "Un personnage",
  /** No sub-kind for a person: their initial stands in for a missing face. */
  glyph: (one) => one.title.charAt(0).toUpperCase(),
  /** A life said the way the collection says it everywhere else. */
  under: (one) => {
    const { start, end } = one;
    if (start && end) return `${formatDateYear(start)} – ${formatDateYear(end)}`;
    if (start) return `né en ${formatDateYear(start)}`;
    if (end) return `† ${formatDateYear(end)}`;
    return "";
  },
  castLegend: "Cité par",
  castAside: "Ces événements restent à leur auteur : la copie n'apporte que la personne.",
  filedLegend: "Se tient dans",
  filedAside: "Les arbres de leur auteur ; les vôtres sont les vôtres.",
  nothing:
    "Personne de tel dans la chronique. Essayez d'élargir l'époque ou la région — ou écrivez la fiche vous-même.",
};

/**
 * Every kind's look, by kind.
 *
 * The panel is given one look for the list it shows, but a card opened from
 * inside another — an event inside a classeur — must be drawn as the thing it
 * is, not as the thing that held it.
 */
export const TERRITORY_LOOK: Look = {
  many: "Territoires de la chronique",
  one: "Un territoire",
  /** No picture and no type: the initial of the polity it draws. */
  glyph: (one) => one.title.charAt(0).toUpperCase(),
  /**
   * Its extent and the years it was painted for.
   *
   * The size comes first because it is what places a shape: "24 319 km² ·
   * 1000 – 1477" says duchy, where the years alone say nothing.
   */
  under: (one) => [one.note, span(one)].filter(Boolean).join(" · "),
  /**
   * Straight to the map, with no card in between.
   *
   * A card could name a territory and measure it, and say nothing about the
   * one thing that decides whether the reader wants it: what it covers.
   * Since the outline rides along in the row, the plate can show it at once.
   */
  onTheMap: true,
  castLegend: "",
  castAside: "",
  filedLegend: "",
  filedAside: "",
  nothing:
    "Aucun territoire de ce genre dans la chronique. Essayez d'élargir l'époque ou la région — ou peignez le vôtre.",
};

export const TREE_LOOK: Look = {
  many: "Arbres de la chronique",
  one: "Un arbre",
  glyph: (one) => one.title.charAt(0).toUpperCase(),
  /**
   * How many people across how many generations, and the span of their
   * lives — which is what tells a lineage of three from a dynasty of forty.
   */
  under: (one) => [one.note, span(one)].filter(Boolean).join(" · "),
  /**
   * Straight to the drawing, as a territory goes straight to the map.
   *
   * A card can count a genealogy and date it, and say nothing of its shape —
   * and the shape is the whole of what anybody wants to see before taking
   * one. Unlike a territory, the drawing is not in the row: it is fetched
   * when the row is touched, which is one short wait for a great deal.
   */
  onTheMap: true,
  castLegend: "",
  castAside: "",
  filedLegend: "",
  filedAside: "",
  nothing:
    "Aucun arbre de ce genre dans la chronique. Essayez d'élargir l'époque ou la région — ou bâtissez le vôtre.",
};

export const LOOKS: Record<Kind, Look> = {
  event: EVENT_LOOK,
  character: CHARACTER_LOOK,
  folder: FOLDER_LOOK,
  territory: TERRITORY_LOOK,
  tree: TREE_LOOK,
};
