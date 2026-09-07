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
import { matchesFilters } from "./filtering";
import {
  NO_FILTERS,
  type EventDraft,
  type EventPhoto,
  type EventFilters,
  type Folder,
  type HistoricalEvent,
} from "./types";

type EventsContextValue = {
  events: HistoricalEvent[];
  /** Chronological, after filters — the list the map and timeline both read. */
  visibleEvents: HistoricalEvent[];
  folders: Folder[];
  filters: EventFilters;
  setFilters: (filters: EventFilters) => void;
  selectedEvent: HistoricalEvent | null;
  /** The event being read and its immediate chronological neighbours. */
  neighbours: {
    previous: HistoricalEvent | null;
    current: HistoricalEvent | null;
    next: HistoricalEvent | null;
  };
  selectEvent: (id: string | null) => void;
  /** Moves the selection along the timeline; clamped at both ends. */
  step: (delta: 1 | -1) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addFolder: (name: string) => Promise<Folder>;
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

  // A filter change can hide the selected event; drop the stale selection so
  // the summary card and the arrows never point at something off the map.
  useEffect(() => {
    if (selectedId !== null && selectedEvent === null) setSelectedId(null);
  }, [selectedId, selectedEvent]);

  // The map is never blank: with nothing chosen it opens on the earliest event
  // of whatever the filters select.
  useEffect(() => {
    if (selectedId === null && visibleEvents.length > 0) {
      setSelectedId(visibleEvents[0]!.id);
    }
  }, [selectedId, visibleEvents]);

  const neighbours = useMemo(() => {
    const index = visibleEvents.findIndex((event) => event.id === selectedId);
    if (index === -1) return { previous: null, current: null, next: null };
    return {
      previous: visibleEvents[index - 1] ?? null,
      current: visibleEvents[index] ?? null,
      next: visibleEvents[index + 1] ?? null,
    };
  }, [visibleEvents, selectedId]);

  const step = useCallback(
    (delta: 1 | -1) => {
      if (visibleEvents.length === 0) return;
      const current = visibleEvents.findIndex((e) => e.id === selectedId);
      const next =
        current === -1
          ? delta === 1
            ? 0
            : visibleEvents.length - 1
          : Math.min(Math.max(current + delta, 0), visibleEvents.length - 1);
      setSelectedId(visibleEvents[next]?.id ?? null);
    },
    [visibleEvents, selectedId],
  );

  const addFolder = useCallback(async (name: string) => {
    const folder = await api.createFolder(name);
    setFolders((current) =>
      [...current, folder].sort((a, b) => a.name.localeCompare(b.name)),
    );
    return folder;
  }, []);

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
      selectedEvent,
      neighbours,
      selectEvent: setSelectedId,
      step,
      loading,
      error,
      refresh,
      addFolder,
      addEvent,
      editEvent,
      removeEvent,
    }),
    [
      events, visibleEvents, folders, filters, selectedEvent, neighbours, step,
      loading, error, refresh, addFolder, addEvent, editEvent, removeEvent,
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
