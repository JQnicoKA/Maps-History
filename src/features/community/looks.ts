import type { Look } from "./Catalogue";
import { formatEventPeriod, formatDateYear } from "../events/historicalDate";
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
