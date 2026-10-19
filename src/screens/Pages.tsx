import { useState, type ReactNode } from "react";

import { Catalogue } from "../features/community/Catalogue";
import {
  CHARACTER_LOOK,
  EVENT_LOOK,
  TREE_LOOK,
} from "../features/community/looks";
import { CharacterDetailModal } from "../features/events/components/CharacterDetailModal";
import { CharacterEditModal } from "../features/events/components/CharacterEditModal";
import { EventDetailModal } from "../features/events/components/EventDetailModal";
import { EventFormModal } from "../features/events/components/EventFormModal";
import { useEvents } from "../features/events/EventsProvider";
import type { HistoricalEvent } from "../features/events/types";
import { TreeBuilder } from "../features/genealogy/TreeBuilder";
import { AccountScreen } from "./Account/AccountScreen";
import type { useNotices } from "../features/community/NoticeList";
import { usePlacement } from "../features/placement";

/**
 * A page open over whatever tab is showing: an event, a person, the form on a
 * person, a tree, the community catalogue.
 *
 * One state rather than six flags, because only one is ever up — and six
 * independent flags would have allowed the pairs iOS refuses to present at
 * once. Everything is held by id and looked up as it is drawn, so a page does
 * not go stale behind an edit made on top of it.
 */
export type Page =
  | { kind: "event"; id: string }
  | { kind: "person"; id: string }
  /** `null` invents one. */
  | { kind: "editPerson"; id: string | null }
  | { kind: "tree"; id: string }
  /** Votre compte, en pleine page : un détour, pas une destination. */
  | { kind: "account" }
  /** The community catalogue, which is about no one row in particular. */
  | { kind: "searchEvents" }
  | { kind: "searchCharacters" }
  | { kind: "searchTrees" }
  /**
   * Le catalogue ouvert d'emblée sur une entrée, carte en avant.
   *
   * Pour « Voir » : une notification ou le formulaire d'un exemplaire en
   * retard mène à la version que la bibliothèque a corrigée, et c'est elle
   * qui porte le bouton de reprise. `of` dit dans quel catalogue chercher.
   */
  | { kind: "entry"; of: "event" | "character"; id: string };

export type PagesHandle = {
  /** Met une page par-dessus ce qui est à l'écran. */
  raise: (target: Page) => void;
  /** Ouvre le formulaire d'événement — vierge, ou sur celui qu'on corrige. */
  compose: (event: HistoricalEvent | null) => void;
  /** À poser une fois dans la coquille, au-dessus des quatre onglets. */
  layer: ReactNode;
};

/**
 * Tout ce qui se lève par-dessus les onglets, et l'ordre dans lequel ça se
 * lève.
 *
 * **Cette machinerie vivait dans `MapScreen`, et elle n'y avait rien de
 * cartographique.** Elle y était parce que la carte était l'unique écran de
 * l'application ; la barre d'onglets en a fait un écran parmi quatre, et une
 * fiche de personnage demandée depuis la page des personnages ne peut pas
 * dépendre de la carte pour s'ouvrir. Elle est donc montée d'un étage, sous
 * la forme que `useNotice` emploie déjà ici : un hook qui rend ses commandes
 * et le morceau de vue qui va avec.
 *
 * Le séquencement est la raison d'être du reste. iOS refuse de présenter une
 * modale depuis un contrôleur qui en descend encore, donc chaque passage de
 * main — un nom dans un événement, un événement dans la fiche de quelqu'un,
 * le crayon d'une liste — baisse une page, attend son `onClosed`, et lève la
 * suivante seulement après. Deviner un délai est ce que cela remplace.
 */
export function usePages({
  drawing,
  notices,
}: {
  drawing: boolean;
  /**
   * Les notifications, lues une fois par la coquille — voir `Shell`.
   *
   * Passées plutôt que relues : la page du compte est la seule à pouvoir les
   * effacer, et la porte qui l'ouvre, dans les bandeaux, doit en montrer le
   * compte dans le même souffle.
   */
  notices: ReturnType<typeof useNotices>;
}): PagesHandle {
  const { events, characters, trees, selectEvent } = useEvents();
  const { aiming } = usePlacement();

  const [page, setPage] = useState<Page | null>(null);
  /** Ce qu'il faut faire une fois la page qui s'en va réellement partie. */
  const [next, setNext] = useState<(() => void) | null>(null);
  /**
   * Où revenir quand la page qui est levée se refermera.
   *
   * Posé une fois au départ d'un détour et honoré à son terme, de sorte que
   * lire trois personnes de suite soit trois touches et non trois voyages.
   */
  const [back, setBack] = useState<Page | null>(null);
  /**
   * Combien de pages ont été levées, ce qui les clé.
   *
   * Pas l'identifiant du sujet : il tombe au moment où la page est baissée,
   * et un remontage à cet instant arracherait la feuille en plein glissement.
   * Compter les levées clé une page sur le seul événement qui doive la
   * re-semer, et sur rien d'autre.
   */
  const [raised, setRaised] = useState(0);

  /** La feuille du formulaire d'événement : écrire, ou corriger. */
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<HistoricalEvent | null>(null);
  /** Combien de fois un formulaire vierge a été demandé, ce qui le clé. */
  const [drafts, setDrafts] = useState(0);

  const raise = (target: Page) => {
    setPage(target);
    setRaised((count) => count + 1);
  };

  /**
   * Baisse la page levée et fait ceci une fois qu'elle est partie.
   *
   * `setNext` reçoit une fonction qui **rend** l'action : React appellerait
   * autrement comme un calcul la fonction qu'on donne à un setter.
   */
  const after = (deed: () => void) => {
    setNext(() => deed);
    setPage(null);
  };

  /** Appelé par chaque page une fois hors de l'écran. */
  const afterPage = () => {
    if (next) {
      const deed = next;
      setNext(null);
      deed();
      return;
    }
    if (back === null) return;
    setBack(null);
    raise(back);
  };

  const compose = (event: HistoricalEvent | null) => {
    setEditing(event);
    if (event === null) setDrafts((count) => count + 1);
    setComposing(true);
  };

  const closeForm = () => {
    setComposing(false);
    setEditing(null);
  };

  /** Quitte l'arbre dessiné et fait ceci, en lui disant lequel c'était. */
  const leaveTree = (deed: (treeId: string) => void) => {
    const treeId = page?.kind === "tree" ? page.id : null;
    if (treeId === null) return;
    setPage(null);
    deed(treeId);
  };

  /** What each page is about, looked up fresh rather than held. */
  const shownEvent =
    page?.kind === "event"
      ? (events.find((one) => one.id === page.id) ?? null)
      : null;
  const shownPerson =
    page?.kind === "person"
      ? (characters.find((one) => one.id === page.id) ?? null)
      : null;
  const edited =
    page?.kind !== "editPerson"
      ? null
      : page.id === null
        ? ("new" as const)
        : (characters.find((one) => one.id === page.id) ?? null);
  /**
   * L'arbre à dessiner — celui qu'on lit, ou celui qu'on vient de quitter.
   *
   * La seconde moitié compte autant que la première. Quitter l'arbre pour une
   * page suspendait son dessin, et le temps que la modale monte on voyait la
   * carte derrière : l'impression que l'arbre s'était refermé alors qu'on
   * allait y revenir. `back` tient exactement l'information manquante — il
   * vaut cet arbre quand et seulement quand on compte y revenir.
   */
  const treeId =
    page?.kind === "tree"
      ? page.id
      : back?.kind === "tree"
        ? back.id
        : null;
  const shownTree =
    treeId === null ? null : (trees.find((one) => one.id === treeId) ?? null);

  return {
    raise,
    compose,
    layer: (
      <>
        <EventFormModal
          // Remonter re-sème chaque champ : sur l'événement qu'on corrige, ou
          // sur le nombre de formulaires vierges demandés.
          key={editing?.id ?? `new-${drafts}`}
          visible={composing}
          event={editing}
          // Descendre d'abord, ouvrir ensuite : `onClosed` lève la fiche une
          // fois cette feuille réellement partie.
          onSeeEntry={(id) => {
            setNext(() => () => raise({ kind: "entry", of: "event", id }));
            closeForm();
          }}
          onClosed={afterPage}
          onCancel={closeForm}
          onSaved={closeForm}
        />

        {/* Someone's page: what a tap asks for, on the plate, on a row, and
            on a name in an event's cast. Every way in leads here, so a face
            on the map is a way into the collection and not a dead end. */}
        <CharacterDetailModal
          key={`page-${raised}`}
          person={shownPerson}
          onEdit={(person) =>
            after(() => raise({ kind: "editPerson", id: person.id }))
          }
          onOpenEvent={(id) =>
            after(() => {
              // The map follows what is being read: the frieze, the markers
              // and the card at the foot of the map would otherwise all be
              // showing a different year from the page on top of them.
              selectEvent(id);
              raise({ kind: "event", id });
            })
          }
          onOpenTree={(id) => after(() => raise({ kind: "tree", id }))}
          onClose={() => setPage(null)}
          onClosed={afterPage}
        />

        <CharacterEditModal
          key={`form-${raised}`}
          target={edited}
          onSeeEntry={(id) =>
            after(() => raise({ kind: "entry", of: "character", id }))
          }
          onClose={() => setPage(null)}
          onClosed={afterPage}
        />

        <EventDetailModal
          key={`event-${raised}`}
          event={shownEvent}
          // The sheet hands over the event it has read whole; the form is
          // never seeded from the summary the map holds.
          onEdit={(whole) => after(() => compose(whole))}
          onOpenCharacter={(id) => after(() => raise({ kind: "person", id }))}
          onClose={() => setPage(null)}
          onClosed={afterPage}
        />

        {/* Les trois mêmes panneaux servent la recherche et le « Voir » d'une
            entrée corrigée : c'est le même catalogue, ouvert sur la liste ou
            sur une carte. En monter un second pour cela aurait fait deux
            exemplaires du même écran à tenir en phase. */}
        <Catalogue
          key={`commons-events-${raised}`}
          kind="event"
          look={EVENT_LOOK}
          visible={
            page?.kind === "searchEvents" ||
            (page?.kind === "entry" && page.of === "event")
          }
          open={page?.kind === "entry" && page.of === "event" ? page.id : null}
          onClose={() => setPage(null)}
          onClosed={afterPage}
        />

        <Catalogue
          key={`commons-people-${raised}`}
          kind="character"
          look={CHARACTER_LOOK}
          visible={
            page?.kind === "searchCharacters" ||
            (page?.kind === "entry" && page.of === "character")
          }
          open={
            page?.kind === "entry" && page.of === "character" ? page.id : null
          }
          onClose={() => setPage(null)}
          onClosed={afterPage}
        />

        <Catalogue
          key={`commons-trees-${raised}`}
          kind="tree"
          look={TREE_LOOK}
          visible={page?.kind === "searchTrees"}
          onClose={() => setPage(null)}
          onClosed={afterPage}
        />

        <AccountScreen
          notices={notices.notices}
          onNoticesChanged={() => void notices.reload()}
          visible={page?.kind === "account"}
          onClose={() => {
            setPage(null);
            afterPage();
          }}
          /* Rien à attendre : cette page est une vue et non une modale, donc
             elle est partie à l'instant où l'état le dit, et le catalogue
             peut se lever dans le même souffle. */
          onSeeEntry={(of, id) =>
            raise({
              kind: "entry",
              of: of === "character" ? "character" : "event",
              id,
            })
          }
        />

        {/* The one drawing, wherever it was asked for. Mounted here because
            it carries pages of its own, which cannot be panels inside a panel
            inside a panel. */}
        <TreeBuilder
          // Sur l'arbre lui-même, et non sur le compteur de levées : celui-ci
          // sert à re-semer un *panneau* à chaque fois qu'on le lève, ce qui
          // n'a pas de sens pour une vue qui doit rester en place pendant
          // qu'une page la survole.
          key={`tree-${shownTree?.id ?? "none"}`}
          tree={shownTree}
          // Le dessin s'ôte quand la carte redevient le contrôle. Sans quoi,
          // créer quelqu'un depuis un arbre menait à viser un point sur une
          // carte que l'arbre recouvrait.
          hidden={aiming || drawing}
          // L'arbre reste dessiné pendant qu'une page le survole, donc il ne
          // peut pas savoir seul qu'on lui est revenu. Ceci le lui dit.
          active={page?.kind === "tree"}
          onClose={() => {
            setPage(null);
            afterPage();
          }}
          onOpenEvent={(id) =>
            leaveTree((openTree) => {
              selectEvent(id);
              setBack({ kind: "tree", id: openTree });
              raise({ kind: "event", id });
            })
          }
          onOpenTree={(id) =>
            // No way back here: the reader asked for another tree, not for a
            // detour out of this one.
            leaveTree(() => raise({ kind: "tree", id }))
          }
          onEditPerson={(id) =>
            leaveTree((openTree) => {
              setBack({ kind: "tree", id: openTree });
              raise({ kind: "editPerson", id });
            })
          }
          onNewPerson={() =>
            leaveTree((openTree) => {
              setBack({ kind: "tree", id: openTree });
              raise({ kind: "editPerson", id: null });
            })
          }
          onSeekPerson={() =>
            leaveTree((openTree) => {
              setBack({ kind: "tree", id: openTree });
              raise({ kind: "searchCharacters" });
            })
          }
        />
      </>
    ),
  };
}
