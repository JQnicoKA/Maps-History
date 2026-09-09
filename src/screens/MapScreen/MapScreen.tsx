import type { LngLat, MapRef } from "@maplibre/maplibre-react-native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MissingConfigNotice } from "./MissingConfigNotice";
import { ViewToggleButton, type ScreenView } from "./ViewToggleButton";
import { Paper } from "../../components/ui";
import { ParchmentOverlay, WorldMap } from "../../components/WorldMap";
import { env } from "../../config/env";
import { MAP_FEATURES } from "../../config/map";
import { useEvents } from "../../features/events/EventsProvider";
import type { HistoricalEvent } from "../../features/events/types";
import { AddEventButton } from "../../features/events/components/AddEventButton";
import { EventDetailModal } from "../../features/events/components/EventDetailModal";
import { EventFormModal } from "../../features/events/components/EventFormModal";
import { EventListView } from "../../features/events/components/EventListView";
import { EventMarkers } from "../../features/events/components/EventMarkers";
import { EventSummaryCard } from "../../features/events/components/EventSummaryCard";
import { LocationReticle } from "../../features/events/components/LocationReticle";
import { FilterButton } from "../../features/filters/FilterButton";
import { PlaceLayers } from "../../features/places/PlaceLayers";
import { TerritoryLayers } from "../../features/territories/TerritoryLayers";
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

  const [view, setView] = useState<ScreenView>("map");
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<HistoricalEvent | null>(null);
  const [placing, setPlacing] = useState(false);
  const [draftLocation, setDraftLocation] = useState<DraftLocation | null>(
    null,
  );
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

      {/* Both stages stay mounted: unmounting the map would throw away the
          camera the reader had set up, and reloading its tiles on every switch. */}
      <View style={[styles.stage, view === "map" ? null : styles.hidden]}>
        <WorldMap
          mapRef={mapRef}
          center={center}
          centerAnimationDuration={hasFramed.current ? 650 : 0}
          attributionOffset={placing ? 0 : insets.bottom + 78}
        >
          {MAP_FEATURES.territories ? <TerritoryLayers /> : null}
          {MAP_FEATURES.places ? <PlaceLayers /> : null}
          <EventMarkers />
        </WorldMap>
      </View>

      <View style={[styles.stage, view === "list" ? null : styles.hidden]}>
        <EventListView
          onOpen={() => setDetailOpen(true)}
          contentPadding={{
            top: insets.top + 62,
            bottom: insets.bottom + 82,
          }}
        />
        <ParchmentOverlay />
      </View>

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
            <View style={styles.topLeft}>
              <ViewToggleButton view={view} onChange={setView} />
            </View>
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
            {selectedEvent && view === "map" ? (
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
        onRequestPlacement={() => {
          setView("map");
          setPlacing(true);
        }}
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
  topLeft: { position: "absolute", left: 0, top: 0 },
  topRight: { position: "absolute", right: 0, top: 0 },
  stage: { flex: 1 },
  hidden: { display: "none" },
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
