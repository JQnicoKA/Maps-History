import type { LngLat, MapRef } from "@maplibre/maplibre-react-native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MissingConfigNotice } from "./MissingConfigNotice";
import { Paper } from "../../components/ui";
import { WorldMap } from "../../components/WorldMap";
import { env } from "../../config/env";
import { useEvents } from "../../features/events/EventsProvider";
import { AddEventButton } from "../../features/events/components/AddEventButton";
import { EventDetailModal } from "../../features/events/components/EventDetailModal";
import { EventFormModal } from "../../features/events/components/EventFormModal";
import {
  EVENT_HIT_LAYER,
  EventMarkers,
} from "../../features/events/components/EventMarkers";
import { EventSummaryCard } from "../../features/events/components/EventSummaryCard";
import { LocationReticle } from "../../features/events/components/LocationReticle";
import { FilterBar } from "../../features/filters/FilterBar";
import { Timeline } from "../../features/timeline/Timeline";
import { palette } from "../../theme/palette";

type DraftLocation = { longitude: number; latitude: number };

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapRef>(null);
  const { selectedEvent, selectEvent, error } = useEvents();

  const [composing, setComposing] = useState(false);
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

  const handleMapPress = useCallback(
    async (nativeEvent: { nativeEvent: { point: [number, number] } }) => {
      if (placing) return;
      const features = await mapRef.current?.queryRenderedFeatures(
        nativeEvent.nativeEvent.point,
        { layers: [EVENT_HIT_LAYER] },
      );
      const id = features?.[0]?.properties?.["id"];
      selectEvent(typeof id === "string" ? id : null);
    },
    [placing, selectEvent],
  );

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
        onPress={handleMapPress}
        attributionOffset={placing ? 0 : 96}
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
          <View style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
            <View style={styles.filters}>
              <FilterBar />
            </View>
            <AddEventButton onPress={() => setComposing(true)} />
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
                onDismiss={() => selectEvent(null)}
              />
            ) : null}
            <Timeline />
          </View>
        </>
      )}

      <EventFormModal
        visible={composing && !placing}
        location={draftLocation}
        onRequestPlacement={() => setPlacing(true)}
        onCancel={() => {
          setComposing(false);
          setDraftLocation(null);
        }}
        onSaved={() => {
          setComposing(false);
          setDraftLocation(null);
        }}
      />

      {detailOpen ? (
        <EventDetailModal
          event={selectedEvent}
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
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  filters: { flex: 1 },
  bottom: { position: "absolute", left: 10, right: 10, gap: 8 },
  error: {
    padding: 10,
    fontSize: 12,
    color: palette.wax,
    textAlign: "center",
  },
});
