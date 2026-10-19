import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import * as api from "./api";
import { mend } from "../community/api";
import { DEFAULT_YEAR } from "../../config/history";
import { matchesFilters, matchesFolders } from "./filtering";
import { useNetwork, useReconnected } from "../network/NetworkProvider";
import { compareByLife, momentOf, standsAt } from "./lifespan";
import { toSortKey } from "./historicalDate";
import { afterRow, erasure, tidy } from "./rows";
import {
  NO_FILTERS,
  type Character,
  type CharacterDraft,
  type EventDraft,
  type StoredPhoto,
  type MapFilters,
  type HistoricalEvent,
  type Move,
  type EventSummary,
  type Tree,
  type TreeBond,
  type LabelWidth,
  type TreePerson,
} from "./types";

/**
 * Un arrêt de la frise : quelque chose qui s'est passé, ou quelqu'un.
 *
 * Une union discriminée et non deux listes à tenir côte à côte : les flèches
 * marchent sur une seule suite ordonnée, et le genre de ce sur quoi elles
 * tombent décide de la carte qu'on montre en bas de l'écran.
 */
export type Stop =
  | { kind: "event"; id: string; at: number; event: EventSummary }
  | { kind: "person"; id: string; at: number; person: Character };

type EventsContextValue = {
  events: EventSummary[];
  /**
   * Chronological, after filters — the list the map and timeline both read.
   * Empty when the reader has put the events away altogether.
   */
  visibleEvents: EventSummary[];
  /**
   * Les noms des classeurs de la collection, triés, une fois chacun.
   *
   * Déduits des événements : un classeur n'a plus de ligne à lui. Voir
   * `folderNames` dans le corps du fournisseur.
   */
  folderNames: string[];
  /** Everyone the collection knows about, by name. */
  characters: Character[];
  /**
   * The people standing on the plate right now: placed, born, not yet dead in
   * the year being read — and only while the filter says to show them.
   */
  visibleCharacters: Character[];
  /** The genealogies, each a cast of characters and the lines between them. */
  trees: Tree[];
  filters: MapFilters;
  /**
   * Changes part of the filter and leaves the rest alone.
   *
   * A patch rather than a whole object: the popup has four independent
   * answers on it, and a caller that replaced the lot would silently undo the
   * other three every time it touched one.
   */
  setFilters: (patch: Partial<MapFilters>) => void;
  /**
   * The date the map is showing, as a position on the continuous axis. This —
   * and not the selected event — is what the borders and the settlements
   * follow, so the reader can come to rest on a year where nothing happened
   * and still watch the world of that year.
   *
   * Null only until the first events arrive.
   */
  year: number | null;
  /** The event being read, when the year has come to rest on one. */
  selectedEvent: EventSummary | null;
  /** Celui qu'on lit, quand c'est quelqu'un plutôt qu'un événement. */
  selectedPerson: Character | null;
  /**
   * The event being read and the ones flanking the current year. `current` is
   * null between two events; `previous` and `next` are still the ones on
   * either side.
   *
   * Des événements seulement : ce sont les trois marqueurs que la planche
   * dessine, et un personnage s'y dessine autrement — voir `CharacterMarkers`.
   * Les flèches de la frise, elles, lisent `steps`.
   */
  neighbours: {
    previous: EventSummary | null;
    current: EventSummary | null;
    next: EventSummary | null;
  };
  /** Tout ce sur quoi la frise peut s'arrêter, dans l'ordre du temps. */
  stops: Stop[];
  /** Et les deux qui encadrent l'arrêt courant, genres confondus. */
  steps: {
    previous: Stop | null;
    current: Stop | null;
    next: Stop | null;
  };
  /** Choisit un événement **ou** quelqu'un, et amène l'année dessus. */
  selectEvent: (id: string | null) => void;
  /**
   * Moves the year, with the event the timeline decided is close enough to
   * count as read — null when the finger has come to rest between two.
   */
  scrubTo: (year: number, eventId: string | null) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /**
   * Puts something into the community, or takes it out.
   *
   * One call for the three kinds: it is one idea, and the row-level security
   * is what makes it safe — the write reaches only the caller's own rows.
   */
  share: (
    kind: "event" | "character" | "tree",
    id: string,
    shared: boolean,
  ) => Promise<void>;
  addCharacter: (draft: CharacterDraft) => Promise<Character>;
  editCharacter: (
    id: string,
    draft: CharacterDraft,
    keptPhotos: StoredPhoto[],
    droppedPhotos: StoredPhoto[],
  ) => Promise<void>;
  /** Drops a character; the events survive, one name shorter. */
  removeCharacter: (character: Character) => Promise<void>;

  addTree: (name: string) => Promise<Tree>;
  renameTree: (id: string, name: string) => Promise<void>;
  removeTree: (id: string) => Promise<void>;
  /**
   * Everything that changes a tree's shape.
   *
   * Each one writes, then re-reads the whole tree rather than patching what is
   * held: a member carries a generation, a rank and its lines, and half a dozen
   * little splices would each be a chance to drift. A tree is a few dozen rows.
   */
  addToTree: (
    treeId: string,
    characterId: string,
    generation: number,
  ) => Promise<void>;
  editTreeMember: (
    treeId: string,
    id: string,
    patch: Partial<
      Pick<TreePerson, "generation" | "position" | "importance" | "note">
    >,
  ) => Promise<void>;
  /** Pose quelques mots dans une case — voir `addTreeLabel`. */
  addLabel: (
    treeId: string,
    text: string,
    generation: number,
    width: LabelWidth,
  ) => Promise<void>;
  /** Son texte, ou sa largeur. */
  editLabel: (
    treeId: string,
    id: string,
    patch: { text?: string; width?: LabelWidth },
  ) => Promise<void>;
  removeFromTree: (treeId: string, memberId: string) => Promise<void>;
  /**
   * Rearranges a row wholesale — see `rows.ts`, which computes the moves.
   *
   * One call rather than one per member: the tree is re-read after a write, and
   * a row shuffled member by member would flicker through every intermediate
   * arrangement on its way to the intended one.
   */
  orderRow: (treeId: string, moves: Move[]) => Promise<void>;
  /**
   * Erases the line between two members, and whatever depended on it — see
   * `erasure` in `rows.ts` for what that means and why.
   */
  eraseLink: (treeId: string, a: string, b: string) => Promise<void>;
  linkInTree: (
    treeId: string,
    kind: TreeBond,
    from: string,
    to: string,
    linked: boolean,
  ) => Promise<void>;
  addEvent: (draft: EventDraft) => Promise<void>;
  editEvent: (
    id: string,
    draft: EventDraft,
    keptPhotos: StoredPhoto[],
    droppedPhotos: StoredPhoto[],
  ) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  /**
   * Reads one event whole — text and every picture.
   *
   * The collection is held in summaries; this is how a sheet that needs more
   * than a summary gets it, and the only shape the editing form accepts.
   */
  loadEvent: (id: string) => Promise<HistoricalEvent>;
};

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [filters, setAllFilters] = useState<MapFilters>(NO_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * L'état du réseau, lu par une référence et non par une dépendance.
   *
   * `refresh` est passé à un effet qui le suit : lui donner `online` dans
   * ses dépendances le reconstruirait à chaque bascule, et rechargerait la
   * collection à chaque fois qu'on entre dans un tunnel.
   */
  const { online } = useNetwork();
  const reachable = useRef(online);
  reachable.current = online;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedEvents, loadedCharacters, loadedTrees] = await Promise.all([
        api.fetchEvents(),
        api.fetchCharacters(),
        api.fetchTrees(),
      ]);
      setEvents(loadedEvents);
      setCharacters(loadedCharacters);
      setTrees(loadedTrees);
      setError(null);
    } catch (cause) {
      /**
       * Hors ligne, on dit la panne plutôt que le symptôme.
       *
       * Un appel mort rend « Network request failed », ou pire une trace de
       * pile d'Expo. Le lecteur n'a pas à traduire : s'il n'y a pas de
       * réseau, la phrase le dit, et elle annonce que la reprise se fera
       * d'elle-même — ce qui est vrai, voir juste en dessous.
       */
      setError(
        reachable.current === false
          ? "Pas de connexion. Votre collection se chargera dès que le réseau revient."
          : cause instanceof Error
            ? cause.message
            : String(cause),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Le réseau revient : on reprend, mais seulement s'il y avait quelque
   * chose à reprendre.
   *
   * Sans la condition, chaque passage sous un tunnel rechargerait la
   * collection entière au retour, alors qu'elle est déjà en mémoire et
   * qu'aucune lecture n'a manqué.
   */
  useReconnected(() => {
    if (error !== null) void refresh();
  });

  /**
   * Le filet des copies, une fois par démarrage.
   *
   * Une copie dont la duplication de fichiers a échoué pointe encore les
   * fichiers de son auteur — et le jour où celui-ci supprime son compte,
   * l'image mourrait. `mend` les rapatrie. Hors du `refresh` et sans
   * dépendances : ce n'est pas une lecture de la collection, c'est une
   * réparation, et elle n'a aucune raison de se rejouer à chaque écriture.
   */
  useEffect(() => {
    void mend();
  }, []);

  /**
   * Le filet des couleurs, une fois par démarrage lui aussi.
   *
   * Même forme que `mend` et pour la même raison : ce n'est pas une lecture de
   * la collection mais un rattrapage, et il n'a aucune raison de se rejouer à
   * chaque écriture. Il couvre les portraits déposés avant que la fonction
   * `tint` existe, et ceux dont le téléchargement avait échoué. Plafonné côté
   * serveur : sur une collection qui en compte cent, il en peint douze par
   * démarrage jusqu'à ce qu'il n'en reste plus.
   */
  useEffect(() => {
    void api.paint();
  }, []);

  const setFilters = useCallback((patch: Partial<MapFilters>) => {
    setAllFilters((current) => ({ ...current, ...patch }));
  }, []);

  const visibleEvents = useMemo(
    () =>
      filters.events
        ? events.filter((event) => matchesFilters(event, filters))
        : [],
    [events, filters],
  );

  /**
   * Les classeurs de cette collection, par leur nom, une fois chacun.
   *
   * Déduits et non pas stockés : un classeur n'est plus une ligne, c'est un nom
   * écrit sur un événement, donc la liste des noms *est* ce qu'on en a écrit.
   * Ce qui s'ensuit, et qui est voulu : le dernier événement d'un sujet
   * emporte le sujet en partant. Un classeur vide n'existe pas plus qu'une
   * étagère sans livre.
   *
   * Sert à deux choses : la liste où choisir en rangeant un événement, et les
   * cases du filtre.
   */
  /**
   * Les sujets que la collection connaît, tirés des **deux** genres.
   *
   * Un classeur n'est qu'un nom : rien ne distingue celui d'un événement de
   * celui d'un personnage, et les tenir séparés aurait donné au lecteur deux
   * listes qui se ressemblent et qu'il faudrait accorder à la main.
   */
  const folderNames = useMemo(
    () =>
      [
        ...new Set([
          ...events.flatMap((event) => event.folders),
          ...characters.flatMap((person) => person.folders),
        ]),
      ].sort((a, b) => a.localeCompare(b)),
    [events, characters],
  );

  /**
   * Who is on the plate, in the year the reader has come to rest on.
   *
   * Recomputed as the frieze is dragged, which is the point: the people come
   * and go with the century the way the borders do. The list is short — a
   * collection holds tens of names, not thousands — so a filter per year
   * costs nothing worth saving.
   */
  const visibleCharacters = useMemo(
    () =>
      filters.characters && year !== null
        ? characters.filter(
            (person) =>
              standsAt(person, year) && matchesFolders(person, filters),
          )
        : [],
    [characters, filters, year],
  );

  const selectedEvent = useMemo(
    () => visibleEvents.find((event) => event.id === selectedId) ?? null,
    [visibleEvents, selectedId],
  );

  /**
   * Celui qu'on lit, quand c'est quelqu'un.
   *
   * `selectedId` porte les deux genres : un identifiant est un identifiant, et
   * tenir deux sélections exclusives aurait voulu dire les désaccorder un jour.
   * Les deux lectures se font côte à côte, et l'une est nulle quand l'autre ne
   * l'est pas.
   */
  const selectedPerson = useMemo(
    () =>
      !filters.characters || selectedId === null
        ? null
        : (characters.find((one) => one.id === selectedId) ?? null),
    [characters, filters.characters, selectedId],
  );

  /**
   * Choisit ce qu'on lit, et amène l'année dessus.
   *
   * Un événement ou quelqu'un : les flèches de la frise s'arrêtent sur les
   * deux depuis que les personnages y ont leurs marques, et leur demander deux
   * fonctions aurait voulu dire leur demander de savoir sur quoi elles sont
   * tombées. Un identifiant est un identifiant ; on cherche ici.
   */
  const selectEvent = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id === null) return;
      const event = events.find((e) => e.id === id);
      if (event) {
        setYear(toSortKey(event.start));
        return;
      }
      const person = characters.find((one) => one.id === id);
      const at = person === undefined ? -Infinity : momentOf(person);
      if (Number.isFinite(at)) setYear(at);
    },
    [events, characters],
  );

  const scrubTo = useCallback((next: number, eventId: string | null) => {
    setYear(next);
    setSelectedId(eventId);
  }, []);

  // A filter change can hide the selected event; drop the stale selection but
  // stay on the year, so the map does not jump out from under the reader.
  //
  // Les deux lectures comptent : éteindre le calque des personnages doit
  // lâcher celui qu'on lisait, et n'interroger que les événements l'aurait
  // lâché dès qu'on en choisissait un.
  useEffect(() => {
    if (selectedId !== null && selectedEvent === null && selectedPerson === null) {
      setSelectedId(null);
    }
  }, [selectedId, selectedEvent, selectedPerson]);

  // The map is never blank: with nothing chosen it opens on the earliest event
  // of whatever the filters select, and on a default year when there is no
  // event to open on at all.
  //
  // Waiting for the load to finish matters: events arrive empty on the first
  // render, and settling for the default then would pin the year there before
  // the first event ever appeared.
  useEffect(() => {
    if (year !== null || loading) return;
    const first = visibleEvents[0];
    if (first) {
      setSelectedId(first.id);
      setYear(toSortKey(first.start));
    } else {
      setYear(DEFAULT_YEAR);
    }
  }, [year, visibleEvents, loading]);

  /**
   * Ce sur quoi la frise peut s'arrêter, dans l'ordre du temps.
   *
   * Les événements visibles, et **les personnages quand leur calque est
   * allumé** — chacun au moment où il entre dans l'histoire, sa naissance,
   * exactement comme la vue liste les y range (`momentOf`). Les flèches les
   * sautaient : elles ne marchaient que sur les événements, alors que la carte
   * montrait les deux. On passait devant quelqu'un sans jamais s'arrêter.
   *
   * Qui n'a ni naissance ni mort n'y figure pas : `momentOf` rend `-Infinity`,
   * et un arrêt hors du temps mettrait la frise au début du monde.
   */
  const stops = useMemo<Stop[]>(() => {
    const all: Stop[] = visibleEvents.map((event) => ({
      kind: "event",
      id: event.id,
      at: toSortKey(event.start),
      event,
    }));

    if (filters.characters) {
      for (const person of characters) {
        const at = momentOf(person);
        if (Number.isFinite(at)) {
          all.push({ kind: "person", id: person.id, at, person });
        }
      }
    }

    return all.sort((a, b) => a.at - b.at);
  }, [visibleEvents, characters, filters.characters]);

  /** Les deux arrêts qui encadrent celui qu'on lit, genres confondus. */
  const steps = useMemo(() => {
    const index = stops.findIndex((stop) => stop.id === selectedId);
    if (index !== -1) {
      return {
        previous: stops[index - 1] ?? null,
        current: stops[index] ?? null,
        next: stops[index + 1] ?? null,
      };
    }
    const after =
      year === null ? -1 : stops.findIndex((stop) => stop.at > year);
    return {
      previous:
        (after === -1 ? stops[stops.length - 1] : stops[after - 1]) ?? null,
      current: null,
      next: (after === -1 ? undefined : stops[after]) ?? null,
    };
  }, [stops, selectedId, year]);

  const neighbours = useMemo(() => {
    const index = visibleEvents.findIndex((event) => event.id === selectedId);
    if (index !== -1) {
      return {
        previous: visibleEvents[index - 1] ?? null,
        current: visibleEvents[index] ?? null,
        next: visibleEvents[index + 1] ?? null,
      };
    }
    // Resting between two events: nothing is being read, but the arrows and
    // the faded map markers still need to know which way is which.
    const after = year === null
      ? -1
      : visibleEvents.findIndex((event) => toSortKey(event.start) > year);
    return {
      previous: (after === -1 ? visibleEvents[visibleEvents.length - 1] : visibleEvents[after - 1]) ?? null,
      current: null,
      next: (after === -1 ? undefined : visibleEvents[after]) ?? null,
    };
  }, [visibleEvents, selectedId, year]);

  const share = useCallback(
    async (kind: "event" | "character" | "tree", id: string, shared: boolean) => {
      const table = {
        event: "events",
        character: "characters",
        tree: "trees",
      }[kind] as "events" | "characters" | "trees";

      await api.setShared(table, id, shared);

      // One boolean is the whole of what changed; re-reading the collection
      // to learn it would be three queries for one bit.
      const patch = <T extends { id: string; shared: boolean }>(list: T[]) =>
        list.map((one) => (one.id === id ? { ...one, shared } : one));

      if (kind === "event") setEvents(patch);
      if (kind === "character") setCharacters(patch);
      if (kind === "tree") setTrees(patch);
    },
    [],
  );

  const addCharacter = useCallback(async (draft: CharacterDraft) => {
    const created = await api.createCharacter(draft);
    // Avant la relecture, et attendu : la couleur de la carte doit arriver
    // avec la photographie, et non la remplacer une seconde plus tard sous
    // les yeux du lecteur.
    if (draft.photos.length > 0) await api.paint(created.id);
    // Relu, et non pas inséré tel quel : les portraits sont montés *après* la
    // ligne, donc celle qu'on tient ne les porte pas encore. Mais relu seul —
    // la collection entière coûtait cent lectures pour apprendre une photo.
    const whole = (await api.fetchCharacter(created.id)) ?? created;
    setCharacters((current) => byLife([...current, whole]));
    return created;
  }, []);

  const editCharacter = useCallback(
    async (
      id: string,
      draft: CharacterDraft,
      keptPhotos: StoredPhoto[],
      droppedPhotos: StoredPhoto[],
    ) => {
      await api.updateCharacter(id, draft, keptPhotos, droppedPhotos);
      // Seulement s'il y a du nouveau à regarder : retirer une photographie
      // ou corriger sa source ne change pas la couleur de celles qui restent.
      if (draft.photos.length > 0) await api.paint(id);
      // Même raison qu'à la création, et même remède : un seul personnage.
      // Re-trié, car une date de naissance corrigée change sa place.
      const whole = await api.fetchCharacter(id);
      setCharacters((current) =>
        whole === null
          ? current
          : byLife(current.map((one) => (one.id === id ? whole : one))),
      );
    },
    [],
  );

  const removeCharacter = useCallback(async (character: Character) => {
    await api.deleteCharacter(character);
    setCharacters((current) =>
      current.filter((one) => one.id !== character.id),
    );
    // The database cascades the links; mirror that here rather than reloading.
    setEvents((current) =>
      current.map((event) => ({
        ...event,
        characters: event.characters.filter((id) => id !== character.id),
      })),
    );
  }, []);

  /**
   * Re-reads the one tree that was just written to.
   *
   * Every edit inside a tree used to re-read all of them, members and links
   * included, to learn that somebody had moved one place to the left. One tree
   * is what changed, so one tree is what is read.
   */
  const reloadTree = useCallback(async (treeId: string) => {
    const fresh = await api.fetchTree(treeId);
    setTrees((current) =>
      fresh === null
        ? current.filter((tree) => tree.id !== treeId)
        : current.map((tree) => (tree.id === treeId ? fresh : tree)),
    );
    return fresh;
  }, []);

  /** Trees are kept sorted by name, as the list shows them. */
  const byTreeName = (a: Tree, b: Tree) => a.name.localeCompare(b.name);

  const addTree = useCallback(async (name: string) => {
    const created = await api.createTree(name);
    setTrees((current) => [...current, created].sort(byTreeName));
    return created;
  }, []);

  const renameTree = useCallback(async (id: string, name: string) => {
    await api.renameTree(id, name);
    // A name is the whole of what changed; asking the server to read it back
    // would only confirm what we just sent.
    setTrees((current) =>
      current
        .map((tree) => (tree.id === id ? { ...tree, name: name.trim() } : tree))
        .sort(byTreeName),
    );
  }, []);

  const removeTree = useCallback(
    async (id: string) => {
      await api.deleteTree(id);
      setTrees((current) => current.filter((tree) => tree.id !== id));
    },
    [],
  );

  const addToTree = useCallback(
    async (treeId: string, characterId: string, generation: number) => {
      const target = await api.fetchTree(treeId);
      // Just past the rightmost member of that generation — past the
      // *position*, not past the count: with gaps allowed, a row of three can
      // perfectly well end at column 7. An empty row starts where the tree's
      // leftmost column is, so a new generation lines up with the others.
      const past = target === null ? null : afterRow(target, generation);
      const position =
        past ??
        Math.min(0, ...(target?.members ?? []).map((member) => member.position));
      await api.addTreeMember(treeId, characterId, generation, position);
      await reloadTree(treeId);
    },
    [reloadTree],
  );

  const editTreeMember = useCallback(
    async (
      treeId: string,
      id: string,
      patch: Partial<
        Pick<TreePerson, "generation" | "position" | "importance" | "note">
      >,
    ) => {
      await api.updateTreeMember(id, patch);
      await reloadTree(treeId);
    },
    [reloadTree],
  );

  /**
   * Une étiquette au bout du rang, comme un personnage qu'on ajoute.
   *
   * La colonne est calculée ici et non demandée à l'appelant : c'est la même
   * règle que pour une personne — après la dernière case occupée de la rangée,
   * largeur comprise.
   */
  const addLabel = useCallback(
    async (
      treeId: string,
      text: string,
      generation: number,
      width: LabelWidth,
    ) => {
      // Relu plutôt que pris dans l'état : la rangée a pu bouger depuis le
      // dernier rendu, et deux cases dans la même colonne sont précisément ce
      // que cette arithmétique existe pour éviter.
      const target = await api.fetchTree(treeId);
      const past = target === null ? null : afterRow(target, generation);
      const position =
        past ??
        Math.min(0, ...(target?.members ?? []).map((member) => member.position));
      await api.addTreeLabel(treeId, text, generation, position, width);
      await reloadTree(treeId);
    },
    [reloadTree],
  );

  const editLabel = useCallback(
    async (
      treeId: string,
      id: string,
      patch: { text?: string; width?: LabelWidth },
    ) => {
      await api.updateTreeLabel(id, patch);
      await reloadTree(treeId);
    },
    [reloadTree],
  );

  const removeFromTree = useCallback(
    async (treeId: string, memberId: string) => {
      await api.removeTreeMember(memberId);
      await reloadTree(treeId);
    },
    [reloadTree],
  );

  const orderRow = useCallback(
    async (treeId: string, moves: Move[]) => {
      /**
       * Shown first, written second.
       *
       * A rearranged row used to wait on the network before anything moved:
       * the card sprang back to where it started, paused for a second or
       * four, then jumped. The reader's own gesture already said where it
       * goes, and the answer is not the server's to give — so the tree is
       * rearranged here and now, and the writing catches up behind.
       */
      const applied = new Map(moves.map((move) => [move.id, move.position]));
      const rearrange = (tree: Tree): Tree => ({
        ...tree,
        members: tree.members.map((member) => {
          const position = applied.get(member.id);
          return position === undefined ? member : { ...member, position };
        }),
      });
      const before = trees;
      setTrees((current) =>
        current.map((tree) => (tree.id === treeId ? rearrange(tree) : tree)),
      );

      try {
        await api.reorderTreeMembers(moves);
      } catch (cause) {
        // Put back exactly what was there. A row left showing an arrangement
        // the server refused would be a lie the reader cannot see through.
        setTrees(before);
        throw cause;
      }
    },
    [trees],
  );

  const eraseLink = useCallback(
    async (treeId: string, a: string, b: string) => {
      const fresh = await api.fetchTree(treeId);
      for (const line of fresh ? erasure(fresh, a, b) : []) {
        await api.unlinkTreeMembers(line.from, line.to);
      }
      await reloadTree(treeId);
    },
    [reloadTree],
  );

  const linkInTree = useCallback(
    async (
      treeId: string,
      kind: TreeBond,
      from: string,
      to: string,
      linked: boolean,
    ) => {
      if (linked) await api.linkTreeMembers(treeId, kind, from, to);
      else await api.unlinkTreeMembers(from, to);

      // Marrying two people who had someone between them closes the gap at
      // once. The alternative — drawing the bar across a stranger and waiting
      // for the reader to sort it out — is how the drawing comes to lie.
      if (linked && kind === "couple") {
        const fresh = await api.fetchTree(treeId);
        const married = fresh?.members.find((member) => member.id === from);
        if (fresh && married) {
          // One request, and all of it or none: the same guarantee `orderRow`
          // relies on, for the same reason.
          await api.reorderTreeMembers(tidy(fresh, married.generation));
        }
      }
      await reloadTree(treeId);
    },
    [reloadTree],
  );

  /**
   * Chronological, as the database hands them over and as every reader of this
   * list assumes: the timeline walks it, and so do the two arrows.
   */
  /**
   * L'ordre des personnages, celui que `fetchCharacters` applique en arrivant.
   * Replacer une ligne dans la liste oblige à le réappliquer, sinon le
   * nouveau venu se retrouve en queue quelle que soit sa naissance.
   */
  const byLife = (list: Character[]) => [...list].sort(compareByLife);

  const inOrder = (list: EventSummary[]) =>
    [...list].sort((a, b) => toSortKey(a.start) - toSortKey(b.start));

  const addEvent = useCallback(async (draft: EventDraft) => {
    // Placed in the list rather than fetched again with everything else: one
    // new event used to cost a re-read of the whole collection — events,
    // characters and trees — which is three queries to learn one row.
    const created = await api.createEvent(draft);
    setEvents((current) => inOrder([...current, created]));
  }, []);

  const editEvent = useCallback(
    async (
      id: string,
      draft: EventDraft,
      keptPhotos: StoredPhoto[],
      droppedPhotos: StoredPhoto[],
    ) => {
      const updated = await api.updateEvent(id, draft, keptPhotos, droppedPhotos);
      // Re-sorted, not merely replaced: an edit may have moved its date, and
      // an event out of order would put the timeline's arrows out of order too.
      setEvents((current) =>
        inOrder(current.map((event) => (event.id === id ? updated : event))),
      );
    },
    [],
  );

  const removeEvent = useCallback(async (id: string) => {
    await api.deleteEvent(id);
    setSelectedId(null);
    setEvents((current) => current.filter((event) => event.id !== id));
  }, []);

  const loadEvent = useCallback((id: string) => api.fetchEvent(id), []);

  const value = useMemo<EventsContextValue>(
    () => ({
      events,
      visibleEvents,
      folderNames,
      characters,
      visibleCharacters,
      trees,
      filters,
      setFilters,
      year,
      selectedEvent,
      selectedPerson,
      neighbours,
      stops,
      steps,
      selectEvent,
      scrubTo,
      loading,
      error,
      refresh,
      share,
      addCharacter,
      editCharacter,
      removeCharacter,
      addTree,
      renameTree,
      removeTree,
      addToTree,
      editTreeMember,
      addLabel,
      editLabel,
      removeFromTree,
      orderRow,
      eraseLink,
      linkInTree,
      addEvent,
      editEvent,
      removeEvent,
      loadEvent,
    }),
    [
      events, visibleEvents, folderNames, characters, visibleCharacters, trees,
      filters, setFilters, year,
      selectedEvent, selectedPerson, neighbours, stops, steps,
      selectEvent, scrubTo, loading, error, refresh,
      share, addCharacter, editCharacter,
      removeCharacter, addTree, renameTree, removeTree, addToTree, addLabel,
      editLabel,
      editTreeMember, removeFromTree, orderRow, eraseLink, linkInTree,
      addEvent,
      editEvent, removeEvent, loadEvent,
    ],
  );

  return (
    <EventsContext.Provider value={value}>{children}</EventsContext.Provider>
  );
}

export function useEvents(): EventsContextValue {
  const value = useContext(EventsContext);
  if (!value) throw new Error("useEvents must be used inside an EventsProvider");
  return value;
}
