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
  selectEvent: (id: string | null) => void;
  /** Moves the selection along the timeline; clamped at both ends. */
  step: (delta: 1 | -1) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addFolder: (name: string) => Promise<Folder>;
  addEvent: (draft: EventDraft) => Promise<void>;
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
      selectEvent: setSelectedId,
      step,
      loading,
      error,
      refresh,
      addFolder,
      addEvent,
      removeEvent,
    }),
    [
      events, visibleEvents, folders, filters, selectedEvent, step,
      loading, error, refresh, addFolder, addEvent, removeEvent,
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
