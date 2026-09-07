import type { LngLat, MapRef } from "@maplibre/maplibre-react-native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MissingConfigNotice } from "./MissingConfigNotice";
import { Paper } from "../../components/ui";
import { WorldMap } from "../../components/WorldMap";
import { env } from "../../config/env";
import { useEvents } from "../../features/events/EventsProvider";
import type { HistoricalEvent } from "../../features/events/types";
import { AddEventButton } from "../../features/events/components/AddEventButton";
import { EventDetailModal } from "../../features/events/components/EventDetailModal";
import { EventFormModal } from "../../features/events/components/EventFormModal";
import { EventMarkers } from "../../features/events/components/EventMarkers";
import { EventSummaryCard } from "../../features/events/components/EventSummaryCard";
import { LocationReticle } from "../../features/events/components/LocationReticle";
import { FilterButton } from "../../features/filters/FilterButton";
import { Timeline } from "../../features/timeline/Timeline";
import { TimelineArrow } from "../../features/timeline/TimelineArrow";
import { palette } from "../../theme/palette";

type DraftLocation = { longitude: number; latitude: number };

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapRef>(null);
  const { selectedEvent, error } = useEvents();
  // The opening shot should not fly across the world; every later move should.
  const hasFramed = useRef(false);

  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<HistoricalEvent | null>(null);
  const [placing, setPlacing] = useState(false);
  const [draftLocation, setDraftLocation] = useState<DraftLocation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Selecting an event recentres the plate; the zoom the reader chose is left
  // alone on purpose.
  const center = useMemo<LngLat | undefined>(
    () =>
      selectedEvent
        ? [selectedEvent.longitude, selectedEvent.latitude]
        : undefined,
    [selectedEvent],
  );

  useEffect(() => {
    if (center) hasFramed.current = true;
  }, [center]);

  const confirmPlacement = useCallback(async () => {
    const centre = await mapRef.current?.getCenter();
    if (centre) {
      setDraftLocation({ longitude: centre[0], latitude: centre[1] });
    }
    setPlacing(false);
  }, []);

  const missing = [
    ...(env.hasMapTilerApiKey ? [] : ["EXPO_PUBLIC_MAPTILER_API_KEY"]),
    ...(env.hasSupabase
      ? []
      : ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"]),
  ];

  if (missing.length > 0) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <MissingConfigNotice missing={missing} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <WorldMap
        mapRef={mapRef}
        center={center}
        centerAnimationDuration={hasFramed.current ? 650 : 0}
        attributionOffset={placing ? 0 : insets.bottom + 78}
      >
        <EventMarkers />
      </WorldMap>

      {placing ? (
        <LocationReticle
          onConfirm={() => void confirmPlacement()}
          onCancel={() => setPlacing(false)}
          bottomInset={insets.bottom}
        />
      ) : (
        <>
          <View
            style={[styles.top, { top: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <FilterButton />
            <View style={styles.topRight}>
              <AddEventButton
                onPress={() => {
                  setEditing(null);
                  setDraftLocation(null);
                  setComposing(true);
                }}
              />
            </View>
          </View>

          <View
            style={[styles.bottom, { bottom: insets.bottom + 8 }]}
            pointerEvents="box-none"
          >
            {error ? (
              <Paper>
                <Text style={styles.error}>{error}</Text>
              </Paper>
            ) : null}
            {selectedEvent ? (
              <EventSummaryCard
                event={selectedEvent}
                onOpen={() => setDetailOpen(true)}
              />
            ) : null}
            <View style={styles.timelineRow} pointerEvents="box-none">
              <TimelineArrow direction="previous" />
              <View style={styles.timeline}>
                <Timeline />
              </View>
              <TimelineArrow direction="next" />
            </View>
          </View>
        </>
      )}

      <EventFormModal
        // Remounting on identity re-seeds every field from the event.
        key={editing?.id ?? "new"}
        visible={composing && !placing}
        event={editing}
        location={draftLocation}
        onRequestPlacement={() => setPlacing(true)}
        onCancel={() => {
          setComposing(false);
          setEditing(null);
          setDraftLocation(null);
        }}
        onSaved={() => {
          setComposing(false);
          setEditing(null);
          setDraftLocation(null);
        }}
      />

      {detailOpen ? (
        <EventDetailModal
          event={selectedEvent}
          onEdit={() => {
            if (!selectedEvent) return;
            setDetailOpen(false);
            setEditing(selectedEvent);
            setDraftLocation({
              longitude: selectedEvent.longitude,
              latitude: selectedEvent.latitude,
            });
            setComposing(true);
          }}
          onClose={() => setDetailOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  top: {
    position: "absolute",
    left: 10,
    right: 10,
    alignItems: "center",
  },
  topRight: { position: "absolute", right: 0, top: 0 },
  bottom: { position: "absolute", left: 10, right: 10, gap: 8 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeline: { flex: 1 },
  error: {
    padding: 10,
    fontSize: 12,
    color: palette.wax,
    textAlign: "center",
  },
});
