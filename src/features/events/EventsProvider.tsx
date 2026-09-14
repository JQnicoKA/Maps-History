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
import {
  NO_FILTERS,
  type EventDraft,
  type EventPhoto,
  type EventFilters,
  type Folder,
  type HistoricalEvent,
  type PickedPhoto,
} from "./types";

type EventsContextValue = {
  events: HistoricalEvent[];
  /** Chronological, after filters — the list the map and timeline both read. */
  visibleEvents: HistoricalEvent[];
  folders: Folder[];
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
  selectedEvent: HistoricalEvent | null;
  /**
   * The event being read and the ones flanking the current year. `current` is
   * null between two events; `previous` and `next` are still the ones on
   * either side.
   */
  neighbours: {
    previous: HistoricalEvent | null;
    current: HistoricalEvent | null;
    next: HistoricalEvent | null;
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
  /** Sets or clears a folder's cover picture — the map marker's fallback. */
  setFolderPhoto: (folder: Folder, picked: PickedPhoto | null) => Promise<void>;
  addEvent: (draft: EventDraft) => Promise<void>;
  editEvent: (
    id: string,
    draft: EventDraft,
    keptPhotos: EventPhoto[],
    droppedPhotos: EventPhoto[],
  ) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
};

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<HistoricalEvent[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [filters, setFilters] = useState<EventFilters>(NO_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedEvents, loadedFolders] = await Promise.all([
        api.fetchEvents(),
        api.fetchFolders(),
      ]);
      setEvents(loadedEvents);
      setFolders(loadedFolders);
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

  const addEvent = useCallback(
    async (draft: EventDraft) => {
      await api.createEvent(draft);
      await refresh();
    },
    [refresh],
  );

  const editEvent = useCallback(
    async (
      id: string,
      draft: EventDraft,
      keptPhotos: EventPhoto[],
      droppedPhotos: EventPhoto[],
    ) => {
      await api.updateEvent(id, draft, keptPhotos, droppedPhotos);
      await refresh();
    },
    [refresh],
  );

  const removeEvent = useCallback(async (id: string) => {
    await api.deleteEvent(id);
    setSelectedId(null);
    setEvents((current) => current.filter((event) => event.id !== id));
  }, []);

  const value = useMemo<EventsContextValue>(
    () => ({
      events,
      visibleEvents,
      folders,
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
      setFolderPhoto,
      addEvent,
      editEvent,
      removeEvent,
    }),
    [
      events, visibleEvents, folders, filters, year, selectedEvent, neighbours,
      selectEvent, scrubTo, loading, error, refresh, addFolder, renameFolder,
      removeFolder, setFolderPhoto, addEvent, editEvent, removeEvent,
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
