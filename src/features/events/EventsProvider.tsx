import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import * as api from "./api";
import { DEFAULT_YEAR } from "../../config/history";
import { matchesFilters } from "./filtering";
import { toSortKey } from "./historicalDate";
import { erasure, tidy } from "./rows";
import {
  NO_FILTERS,
  type Character,
  type CharacterDraft,
  type EventDraft,
  type StoredPhoto,
  type EventFilters,
  type Folder,
  type HistoricalEvent,
  type Move,
  type EventSummary,
  type Tree,
  type TreeBond,
  type TreeMember,
  type PickedPhoto,
} from "./types";

type EventsContextValue = {
  events: EventSummary[];
  /** Chronological, after filters — the list the map and timeline both read. */
  visibleEvents: EventSummary[];
  folders: Folder[];
  /** Everyone the collection knows about, by name. */
  characters: Character[];
  /** The genealogies, each a cast of characters and the lines between them. */
  trees: Tree[];
  filters: EventFilters;
  setFilters: (filters: EventFilters) => void;
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
  /**
   * The event being read and the ones flanking the current year. `current` is
   * null between two events; `previous` and `next` are still the ones on
   * either side.
   */
  neighbours: {
    previous: EventSummary | null;
    current: EventSummary | null;
    next: EventSummary | null;
  };
  /** Selects an event and moves the year onto its date. */
  selectEvent: (id: string | null) => void;
  /**
   * Moves the year, with the event the timeline decided is close enough to
   * count as read — null when the finger has come to rest between two.
   */
  scrubTo: (year: number, eventId: string | null) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addFolder: (name: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  /** Drops a folder; the events it held survive, unfiled. */
  removeFolder: (folder: Folder) => Promise<void>;
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
      Pick<TreeMember, "generation" | "position" | "importance" | "note">
    >,
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
  /** Sets or clears a folder's cover picture — the map marker's fallback. */
  setFolderPhoto: (folder: Folder, picked: PickedPhoto | null) => Promise<void>;
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
  const [folders, setFolders] = useState<Folder[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [filters, setFilters] = useState<EventFilters>(NO_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedEvents, loadedFolders, loadedCharacters, loadedTrees] =
        await Promise.all([
          api.fetchEvents(),
          api.fetchFolders(),
          api.fetchCharacters(),
          api.fetchTrees(),
        ]);
      setEvents(loadedEvents);
      setFolders(loadedFolders);
      setCharacters(loadedCharacters);
      setTrees(loadedTrees);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleEvents = useMemo(
    () => events.filter((event) => matchesFilters(event, filters)),
    [events, filters],
  );

  const selectedEvent = useMemo(
    () => visibleEvents.find((event) => event.id === selectedId) ?? null,
    [visibleEvents, selectedId],
  );

  const selectEvent = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      const event = id === null ? null : events.find((e) => e.id === id);
      if (event) setYear(toSortKey(event.start));
    },
    [events],
  );

  const scrubTo = useCallback((next: number, eventId: string | null) => {
    setYear(next);
    setSelectedId(eventId);
  }, []);

  // A filter change can hide the selected event; drop the stale selection but
  // stay on the year, so the map does not jump out from under the reader.
  useEffect(() => {
    if (selectedId !== null && selectedEvent === null) setSelectedId(null);
  }, [selectedId, selectedEvent]);

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

  const addFolder = useCallback(async (name: string) => {
    const folder = await api.createFolder(name);
    setFolders((current) => [...current, folder].sort(byName));
    return folder;
  }, []);

  /** Folders are kept sorted by name, so renaming one moves it in the list. */
  const byName = (a: Folder, b: Folder) => a.name.localeCompare(b.name);

  const renameFolder = useCallback(async (id: string, name: string) => {
    const updated = await api.renameFolder(id, name);
    setFolders((current) =>
      current.map((one) => (one.id === updated.id ? updated : one)).sort(byName),
    );
  }, []);

  const removeFolder = useCallback(async (folder: Folder) => {
    await api.deleteFolder(folder);
    setFolders((current) => current.filter((one) => one.id !== folder.id));
    // The database cascades the links; mirror that here rather than reloading,
    // and drop the filter that would otherwise hide everything.
    setEvents((current) =>
      current.map((event) => ({
        ...event,
        folders: event.folders.filter((link) => link.folderId !== folder.id),
      })),
    );
    setFilters((current) => ({
      folders: current.folders.filter((one) => one.folderId !== folder.id),
    }));
  }, []);

  const setFolderPhoto = useCallback(
    async (folder: Folder, picked: PickedPhoto | null) => {
      const updated = await api.setFolderPhoto(folder, picked);
      setFolders((current) =>
        current.map((one) => (one.id === updated.id ? updated : one)),
      );
    },
    [],
  );

  const addCharacter = useCallback(async (draft: CharacterDraft) => {
    const created = await api.createCharacter(draft);
    // Re-read rather than splice in the returned row: the pictures were
    // uploaded after it, so the row we hold does not carry them yet.
    setCharacters(await api.fetchCharacters());
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
      setCharacters(await api.fetchCharacters());
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
      // Appended to the right of its generation, which is where a reader
      // expects the newcomer to land.
      const position = (target?.members ?? []).filter(
        (member) => member.generation === generation,
      ).length;
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
        Pick<TreeMember, "generation" | "position" | "importance" | "note">
      >,
    ) => {
      await api.updateTreeMember(id, patch);
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
      for (const move of moves) {
        await api.updateTreeMember(move.id, { position: move.position });
      }
      await reloadTree(treeId);
    },
    [reloadTree],
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
          for (const move of tidy(fresh, married.generation)) {
            await api.updateTreeMember(move.id, { position: move.position });
          }
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
  const inOrder = (list: EventSummary[]) =>
    [...list].sort((a, b) => toSortKey(a.start) - toSortKey(b.start));

  const addEvent = useCallback(async (draft: EventDraft) => {
    // Placed in the list rather than fetched again with everything else: one
    // new event used to cost a re-read of the whole collection — events,
    // folders, characters and trees — which is four queries to learn one row.
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
      folders,
      characters,
      trees,
      filters,
      setFilters,
      year,
      selectedEvent,
      neighbours,
      selectEvent,
      scrubTo,
      loading,
      error,
      refresh,
      addFolder,
      renameFolder,
      removeFolder,
      addCharacter,
      editCharacter,
      removeCharacter,
      addTree,
      renameTree,
      removeTree,
      addToTree,
      editTreeMember,
      removeFromTree,
      orderRow,
      eraseLink,
      linkInTree,
      setFolderPhoto,
      addEvent,
      editEvent,
      removeEvent,
      loadEvent,
    }),
    [
      events, visibleEvents, folders, characters, trees, filters, year,
      selectedEvent, neighbours, selectEvent, scrubTo, loading, error, refresh,
      addFolder, renameFolder, removeFolder, addCharacter, editCharacter,
      removeCharacter, addTree, renameTree, removeTree, addToTree,
      editTreeMember, removeFromTree, orderRow, eraseLink, linkInTree, setFolderPhoto,
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
