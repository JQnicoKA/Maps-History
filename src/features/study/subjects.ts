import type { StudyTerritory } from "./api";
import type { StudyPart } from "./parts";
import type { StudyOrder, Subject } from "./plan";
import type { Character, EventSummary, Importance } from "../events/types";

/**
 * Ce qu'une étude interroge.
 *
 * Les événements et les personnages se cumulent — une séance peut mêler ce qui
 * s'est passé et qui était là, et c'est la même question posée du même marqueur.
 * Les territoires sont seuls : ils n'ont ni classeur ni importance, ils n'ont pas
 * de marqueur mais une forme, et leur chemin de réglage n'a donc rien en commun
 * avec l'autre.
 */
export type StudyAim = "events" | "characters" | "territories";

/** La fenêtre de temps des territoires ; `null` pour toute l'histoire. */
export type StudyWindow = { from: number; to: number } | null;

export type StudySetup = {
  aims: StudyAim[];
  /** Les classeurs retenus ; vide veut dire tous. */
  folders: string[];
  /** Les crans d'importance retenus ; vide veut dire tous. */
  importance: Importance[];
  window: StudyWindow;
  /**
   * La partie du monde, pour les territoires seuls.
   *
   * Elle décide ce qu'on va chercher au serveur, et non ce qu'on tamise
   * ensuite : `stock.territories` ne contient déjà que cette partie-là. Elle
   * est gardée dans le réglage parce que le bandeau de l'étude l'annonce et
   * que recommencer la même séance doit redonner la même.
   */
  part: StudyPart | null;
  order: StudyOrder;
};

/** Ce qu'une étude commence par proposer : rien de choisi, l'ordre du temps. */
export const BLANK_SETUP: StudySetup = {
  aims: [],
  folders: [],
  importance: [],
  window: null,
  part: null,
  order: "chronological",
};

/**
 * Un sujet et la chose dont il vient.
 *
 * `plan.ts` ne travaille que sur des `Subject` — un nom et une année —, ce qui
 * est ce qui le rend éprouvable. Mais la planche doit ensuite poser le marqueur
 * de l'événement, ouvrir la tuile du personnage, peindre la forme du
 * territoire : il faut un chemin de retour, et c'est celui-ci.
 */
export type Quarry =
  | { kind: "event"; subject: Subject; event: EventSummary }
  | { kind: "character"; subject: Subject; person: Character }
  | { kind: "territory"; subject: Subject; territory: StudyTerritory };

/**
 * Les territoires sont exclusifs : les choisir range les deux autres.
 *
 * La règle vit ici et non dans la carte à étapes, parce qu'elle décide aussi de
 * ce qui est interrogeable — et qu'une règle écrite dans un bouton se perd au
 * premier bouton suivant.
 */
export function aimAt(aims: StudyAim[], chosen: StudyAim): StudyAim[] {
  if (chosen === "territories") {
    return aims.includes("territories") ? [] : ["territories"];
  }
  const kept = aims.filter((aim) => aim !== "territories");
  return kept.includes(chosen)
    ? kept.filter((aim) => aim !== chosen)
    : [...kept, chosen];
}

/** Un événement est toujours placé : sa position est obligatoire. */
function fromEvent(event: EventSummary): Quarry {
  return {
    kind: "event",
    subject: { id: event.id, label: event.title, at: event.start.year },
    event,
  };
}

/**
 * Un personnage ne peut être interrogé que s'il est **sur la carte**.
 *
 * La question est « qui est posé là ? » : sans point, il n'y a pas de là, et
 * sans naissance il n'y a rien à écrire sous le marqueur ni par quoi ranger la
 * question dans le temps. Six des douze de la collection passent ce filtre, et
 * c'est le filtre lui-même qui le dit plutôt qu'une étude qui s'arrêterait à la
 * première question muette.
 */
function fromCharacter(person: Character): Quarry | null {
  if (person.longitude === null || person.latitude === null) return null;
  if (person.birth === null) return null;
  return {
    kind: "character",
    subject: { id: person.id, label: person.name, at: person.birth.year },
    person,
  };
}

function fromTerritory(territory: StudyTerritory): Quarry {
  return {
    kind: "territory",
    subject: {
      id: territory.id,
      label: territory.name,
      at: territory.from,
    },
    territory,
  };
}

/**
 * Le tamis, qui n'est pas le même selon ce qu'on interroge.
 *
 * Un événement et un personnage se rangent par classeur et par importance ; un
 * territoire du fond de carte n'a ni l'un ni l'autre, il n'a que ses années.
 * C'est toute la raison pour laquelle son chemin de réglage est plus court.
 */
function sifted(quarry: Quarry, setup: StudySetup): boolean {
  if (quarry.kind === "territory") {
    if (setup.window === null) return true;
    /* Un chevauchement, non une inclusion : un empire qui dure de 800 à 1500
       a bien existé dans une fenêtre 1000-1100, et refuser de l'interroger
       parce qu'il la dépasse des deux côtés écarterait précisément les plus
       durables — c'est-à-dire ceux qu'on connaît. */
    return (
      quarry.territory.from <= setup.window.to &&
      quarry.territory.to >= setup.window.from
    );
  }

  const held =
    quarry.kind === "event" ? quarry.event : quarry.person;

  if (
    setup.folders.length > 0 &&
    !held.folders.some((folder) => setup.folders.includes(folder))
  ) {
    return false;
  }
  if (
    setup.importance.length > 0 &&
    !setup.importance.includes(held.importance)
  ) {
    return false;
  }
  return true;
}

export type StudyStock = {
  events: readonly EventSummary[];
  characters: readonly Character[];
  territories: readonly StudyTerritory[];
};

export type Gathered = {
  /** Ce que le filtre retient : les questions qui seront posées. */
  pool: Subject[];
  /**
   * Tout ce qui est interrogeable, filtre ou pas.
   *
   * C'est là que `chooseOptions` prend ses fausses réponses : qui révise un
   * classeur ne doit pas voir les propositions se réduire à ce classeur, ce
   * qui le désignerait.
   */
  everything: Subject[];
  /** Le chemin de retour, du sujet vers la chose — voir `Quarry`. */
  quarry: Map<string, Quarry>;
};

/**
 * Ce qu'une étude a sous la main, trié par ce qu'on lui a demandé.
 *
 * Les événements et les personnages sont déjà tous en mémoire — le fournisseur
 * les tient — donc ce tamis ne coûte rien et n'appelle personne. Les
 * territoires, eux, arrivent du serveur par `fetchTerritoriesToStudy` et sont
 * passés ici tout faits.
 */
export function gather(setup: StudySetup, stock: StudyStock): Gathered {
  const all: Quarry[] = [];

  if (setup.aims.includes("events")) {
    for (const event of stock.events) all.push(fromEvent(event));
  }
  if (setup.aims.includes("characters")) {
    for (const person of stock.characters) {
      const found = fromCharacter(person);
      if (found !== null) all.push(found);
    }
  }
  if (setup.aims.includes("territories")) {
    for (const territory of stock.territories) all.push(fromTerritory(territory));
  }

  const quarry = new Map(all.map((one) => [one.subject.id, one]));
  return {
    pool: all.filter((one) => sifted(one, setup)).map((one) => one.subject),
    everything: all.map((one) => one.subject),
    quarry,
  };
}
