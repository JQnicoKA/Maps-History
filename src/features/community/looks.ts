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
 * Everything else about the panel is the same for all three — the sieve, the
 * paging, the reporting, the blocking — so this is where the differences are
 * kept: a glyph, a line, and the handful of sentences that name things. The
 * search field's own label and placeholder are among them, because "Nom" over
 * "Marignan, sacre, traité…" was wrong on two of the three screens. Written as
 * data rather than as three screens.
 */

export const EVENT_LOOK: Look = {
  many: "Bibliothèque",
  one: "Un événement",
  take: "Copier l'événement",
  named: "Nom de l'événement",
  hint: "Marignan, sacre, traité…",
  ask: "Copier cet événement ?",
  means:
    "Il entre dans votre collection, avec ses photographies et les personnages qu'il cite.",
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
  filedLegend: "Rangé dans",
  /* Vrai depuis que les classeurs ne sont que des noms : le classement est
     écrit sur l'événement, donc il part avec lui. C'était justement la raison
     de les démonter — un classeur-entité restait chez son auteur, et qui
     copiait trois événements recevait trois faits sans leur sujet. */
  filedAside: "Ils viendront avec l'événement si vous le copiez.",
  /* Fermée : un classeur n'a plus de fiche à ouvrir. Les noms s'affichent en
     ligne — voir `SharedCard`, qui range dans `names` ce qui n'a pas de
     porte. */
  filedDoor: "",
  nothing:
    "Rien de tel dans la bibliothèque. Essayez d'élargir l'époque ou la région — ou écrivez-le vous-même.",
};

/** What a tree's span reads like: two years, or one, or none at all. */
const span = (one: { start: { year: number } | null; end: { year: number } | null }) => {
  const from = one.start?.year;
  const to = one.end?.year;
  if (from === undefined) return "";
  if (to === undefined || to === from) return formatYear(from);
  return `${formatYear(from)} – ${formatYear(to)}`;
};

export const CHARACTER_LOOK: Look = {
  many: "Bibliothèque",
  one: "Un personnage",
  take: "Copier le personnage",
  named: "Nom du personnage",
  hint: "Clovis, Aliénor, Soliman…",
  ask: "Copier ce personnage ?",
  means: "Il entre dans votre collection, avec ses photographies.",
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
  castAside:
    "Ces événements restent dans la bibliothèque : la copie n'apporte que la personne.",
  filedLegend: "Se tient dans",
  filedAside: "Les arbres de la bibliothèque ; les vôtres sont les vôtres.",
  /* Ouvert le 13 octobre 2026, avec la moitié SQL qui lui manquait — voir la
     migration `un_personnage_ouvre_ses_arbres`. Un arbre s'ouvre sur son
     dessin et non sur une fiche : c'est là qu'est sa substance. */
  filedDoor: "Voir l'arbre",
  filedKind: "tree",
  nothing:
    "Personne de tel dans la bibliothèque. Essayez d'élargir l'époque ou la région — ou écrivez la fiche vous-même.",
};

/**
 * Every kind's look, by kind.
 *
 * The panel is given one look for the list it shows, but a card opened from
 * inside another — an event inside a classeur — must be drawn as the thing it
 * is, not as the thing that held it.
 */
export const TREE_LOOK: Look = {
  many: "Bibliothèque",
  one: "Un arbre",
  take: "Copier l'arbre",
  named: "Nom de l'arbre",
  /* Des maisons, pas des personnes : on cherche une lignée entière. */
  hint: "Capétiens, Plantagenêt, Habsbourg…",
  ask: "Copier cet arbre ?",
  means:
    "Il entre dans votre collection avec les personnages qui le composent.",
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
  filedDoor: "",
  nothing:
    "Aucun arbre de ce genre dans la bibliothèque. Essayez d'élargir l'époque ou la région — ou bâtissez le vôtre.",
};

export const LOOKS: Record<Kind, Look> = {
  event: EVENT_LOOK,
  character: CHARACTER_LOOK,
  tree: TREE_LOOK,
};
