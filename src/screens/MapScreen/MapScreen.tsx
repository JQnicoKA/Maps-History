import type { LngLat, MapRef } from "@maplibre/maplibre-react-native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MissingConfigNotice } from "./MissingConfigNotice";
import { AccountButton, type ScreenView } from "./AccountButton";
import { InkButton, Paper, useNotice } from "../../components/ui";
import { ParchmentOverlay, WorldMap } from "../../components/WorldMap";
import { env } from "../../config/env";
import { MAP_FEATURES } from "../../config/map";
import { useEvents } from "../../features/events/EventsProvider";
import type {
  Character,
  HistoricalEvent,
} from "../../features/events/types";
import {
  AddEventButton,
  AddPersonButton,
} from "../../features/events/components/AddEventButton";
import { EventDetailModal } from "../../features/events/components/EventDetailModal";
import { EventFormModal } from "../../features/events/components/EventFormModal";
import { EventListView } from "../../features/events/components/EventListView";
import { CharacterEditModal } from "../../features/events/components/CharacterEditModal";
import { CharacterMarkers } from "../../features/events/components/CharacterMarkers";
import { EventMarkers } from "../../features/events/components/EventMarkers";
import { EventSummaryCard } from "../../features/events/components/EventSummaryCard";
import { LocationReticle } from "../../features/events/components/LocationReticle";
import { FilterButton } from "../../features/filters/FilterButton";
import { usePlacement } from "../../features/placement";
import { PlaceLayers } from "../../features/places/PlaceLayers";
import { TerritoryLayers } from "../../features/territories/TerritoryLayers";
import {
  TerritorySheet,
  type TouchedTerritory,
} from "../../features/territories/TerritorySheet";
import { BrushLayers } from "../../features/territories/BrushLayers";
import { BrushOverlay } from "../../features/territories/BrushOverlay";
import { BRUSH_POINTS, brushMetres } from "../../features/territories/brush";
import { DrawPolityBar } from "../../features/territories/DrawPolityBar";
import { DrawTerritoryButton } from "../../features/territories/DrawTerritoryButton";
import { useHidden } from "../../features/territories/HiddenProvider";
import {
  NamePolityDialog,
  type NamedPolity,
} from "../../features/territories/NamePolityDialog";
import type { Stroke } from "../../features/territories/drawn";
import { FRIEZE_HEIGHT, Timeline } from "../../features/timeline/Timeline";
import { palette } from "../../theme/palette";
import { space } from "../../theme/tokens";

/**
 * The strip kept clear at the very bottom for the map credits.
 *
 * They used to float above the frieze, where they read as one more piece of
 * chrome. Under it they are a colophon: the last line on the plate, out of the
 * way of everything one actually touches. Measured from the safe area rather
 * than from the screen edge, so the line clears the home indicator on the
 * phones that have one and does not hang off the bottom on those that do not.
 */
const CREDITS_STRIP = 22;

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapRef>(null);
  const { selectedEvent, error, refresh, filters } = useEvents();
  const { aiming, settle } = usePlacement();
  // The opening shot should not fly across the world; every later move should.
  const hasFramed = useRef(false);

  const [view, setView] = useState<ScreenView>("map");
  const [composing, setComposing] = useState(false);
  /** Which pair of tabs the sheet opens on. */
  const [family, setFamily] = useState<"event" | "people">("event");
  const [editing, setEditing] = useState<HistoricalEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  /** True from country zoom on, where the fiefs are worth drawing. */
  const [detailed, setDetailed] = useState(false);
  /** The territory the finger last landed on, if its card is open. */
  const [touched, setTouched] = useState<TouchedTerritory | null>(null);
  /**
   * Whose card is open — tapped on the plate, or asked for from the list.
   *
   * One card, at the top of the screen, and never inside another sheet: it
   * hands the whole screen to the reticle when a person is placed, and a card
   * nested in a panel would be torn down along with it.
   */
  const [reading, setReading] = useState<Character | "new" | null>(null);
  /**
   * The card asked for from the people sheet, waiting for that sheet to
   * finish leaving. iOS refuses to present a panel from one still dismissing.
   */
  const [queued, setQueued] = useState<Character | "new" | null>(null);
  /** Whether closing the card should bring the people sheet back. */
  const [returning, setReturning] = useState(false);

  const { draw } = useHidden();
  /** Painting: the strokes laid down, the one under the finger, the state. */
  const [drawing, setDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [trail, setTrail] = useState<Stroke>([]);
  const [naming, setNaming] = useState(false);
  /** Brush or hand: what a single finger does right now. */
  const [painting, setPainting] = useState(true);
  const [saving, setSaving] = useState(false);
  const { say: sayMap, dialog: mapDialog } = useNotice();

  const stopDrawing = () => {
    setDrawing(false);
    setStrokes([]);
    setTrail([]);
    setNaming(false);
    setPainting(true);
  };

  /**
   * Saves what was painted, at the scale it was painted at.
   *
   * The brush is chosen in screen points but stored in metres, and the two
   * differ by the zoom and the latitude — so both are read from the map at
   * the moment of saving rather than assumed.
   */
  const keepDrawing = async (named: NamedPolity) => {
    setSaving(true);
    try {
      const [zoom, centre] = await Promise.all([
        mapRef.current?.getZoom() ?? Promise.resolve(4),
        mapRef.current?.getCenter() ?? Promise.resolve([0, 0] as const),
      ]);
      await draw({
        strokes,
        brushMetres: brushMetres(zoom, centre[1]),
        name: named.name,
        from: named.from,
        to: named.to,
      });
      stopDrawing();
    } catch (cause) {
      sayMap(
        "Territoire non enregistré",
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setSaving(false);
    }
  };

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

  /** Answers whoever asked with whatever the crosshair is over. */
  const confirmPlacement = useCallback(async () => {
    const centre = await mapRef.current?.getCenter();
    settle(
      centre ? { longitude: centre[0], latitude: centre[1] } : null,
    );
  }, [settle]);

  // Aiming at a map one cannot see is not aiming. A placement asked for from
  // the list view brings the plate up first.
  useEffect(() => {
    if (aiming) setView("map");
  }, [aiming]);

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
          attributionOffset={aiming || drawing ? 0 : insets.bottom + 4}
          onDetailChange={setDetailed}
          // One finger paints, so it must not also drag the plate. Pinch is
          // untouched: the reader can still zoom to where they are working.
          frozen={drawing && painting}
        >
          {/* Settlements first, territories after: MapLibre places symbols
              from the topmost layer down, so the country name wins the room
              against the town names crowding around its anchor. */}
          {MAP_FEATURES.places ? <PlaceLayers /> : null}
          {MAP_FEATURES.territories && filters.territories ? (
            <TerritoryLayers
              detailed={detailed}
              // Not while an event is being placed: every touch belongs to
              // that, and the reticle is what the reader is aiming with.
              onTouch={aiming || drawing ? undefined : setTouched}
            />
          ) : null}
          {drawing ? (
            <BrushLayers strokes={strokes} trail={trail} width={BRUSH_POINTS} />
          ) : null}
          {/* Rien de la collection pendant qu'on peint : les marqueurs se
              confondraient avec la peinture, et ce n'est pas d'eux qu'il
              s'agit à ce moment-là. */}
          {drawing ? null : <EventMarkers />}
          {/* People last, so a cameo is never buried under a locket: the one
              the finger can see is the one the finger should get. */}
          {drawing ? null : <CharacterMarkers onOpen={setReading} />}
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

      {mapDialog}

      {aiming ? (
        <LocationReticle
          onConfirm={() => void confirmPlacement()}
          onCancel={() => settle(null)}
          bottomInset={insets.bottom}
        />
      ) : null}

      {drawing ? (
        <>
          {/* Absent, not merely disabled, while the hand has the screen:
              a sheet that declines every touch still swallows them. */}
          {painting ? (
            <BrushOverlay
              mapRef={mapRef}
              onStroke={(stroke) => setStrokes((current) => [...current, stroke])}
              onTrail={setTrail}
            />
          ) : null}
          <DrawPolityBar
            strokes={strokes.length}
            busy={saving}
            painting={painting}
            onPaintingChange={setPainting}
            bottom={insets.bottom + space.md}
            onUndo={() => setStrokes((current) => current.slice(0, -1))}
            onCancel={stopDrawing}
            onFinish={() => setNaming(true)}
          />
        </>
      ) : null}

      <NamePolityDialog
        visible={naming}
        busy={saving}
        onConfirm={(named) => void keepDrawing(named)}
        onClose={() => setNaming(false)}
      />

      {aiming || drawing ? null : (
        <>
          <View
            style={[styles.top, { top: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <View style={styles.topLeft}>
              <AccountButton view={view} onChange={setView} />
            </View>
            <FilterButton />
            <View style={styles.topRight}>
              <AddEventButton
                onPress={() => {
                  setEditing(null);
                  setFamily("event");
                  setComposing(true);
                }}
              />
              <AddPersonButton
                onPress={() => {
                  setEditing(null);
                  setFamily("people");
                  setComposing(true);
                }}
              />
              {/* Under the `+`, and apart from it: one adds to the collection,
                  the other changes the map it is read on. */}
              {MAP_FEATURES.territories ? (
                <DrawTerritoryButton onDraw={() => setDrawing(true)} />
              ) : null}
            </View>
          </View>

          {/* Full width, outside the padded column: the strokes have to reach
              the edges of the screen to fade out against them. */}
          <View
            style={[
              styles.frieze,
              { bottom: insets.bottom + CREDITS_STRIP },
            ]}
          >
            <Timeline />
          </View>

          <View
            style={[
              styles.bottom,
              {
                bottom:
                  insets.bottom + CREDITS_STRIP + FRIEZE_HEIGHT + space.sm,
              },
            ]}
            pointerEvents="box-none"
          >
            {error ? (
              // A way back, not just a complaint: the collection is loaded once
              // at launch, so a network that was down at that moment used to
              // leave an empty map and nothing to do about it.
              <Paper style={styles.errorCard}>
                <Text style={styles.error}>{error}</Text>
                <InkButton
                  label="Réessayer"
                  variant="tonal"
                  onPress={() => void refresh()}
                />
              </Paper>
            ) : null}
            {selectedEvent && view === "map" ? (
              <EventSummaryCard
                event={selectedEvent}
                onOpen={() => setDetailOpen(true)}
              />
            ) : null}
          </View>
        </>
      )}

      <EventFormModal
        // Remounting re-seeds every field — on the event being edited, and on
        // the family, whose first tab decides what the sheet opens on.
        key={editing?.id ?? `new-${family}`}
        family={family}
        visible={composing}
        event={editing}
        onOpenCharacter={(target) => {
          // Down, then up: the card is opened by `onClosed` below, once this
          // sheet has actually gone.
          setQueued(target);
          setReturning(true);
          setComposing(false);
        }}
        onClosed={() => {
          if (queued === null) return;
          setReading(queued);
          setQueued(null);
        }}
        onCancel={() => {
          setComposing(false);
          setEditing(null);
        }}
        onSaved={() => {
          setComposing(false);
          setEditing(null);
        }}
      />

      <TerritorySheet territory={touched} onClose={() => setTouched(null)} />

      {/* One card for both ways in — a cameo tapped on the plate, and the
          list in the people sheet — so a face on the map is a way into the
          collection and not a dead end. Keyed on whoever it opens on, whose
          details seed its fields. */}
      <CharacterEditModal
        key={
          reading === null ? "nobody" : reading === "new" ? "new" : reading.id
        }
        target={reading}
        onClose={() => setReading(null)}
        onClosed={() => {
          // Back where they came from, so adding three people in a row is
          // three taps and not three journeys.
          if (!returning) return;
          setReturning(false);
          setFamily("people");
          setComposing(true);
        }}
      />

      {detailOpen ? (
        <EventDetailModal
          event={selectedEvent}
          // The sheet hands over the event it has read whole; the form is
          // never seeded from the summary the map holds.
          onEdit={(whole) => {
            setDetailOpen(false);
            setEditing(whole);
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
  topRight: { position: "absolute", right: 0, top: 0, gap: space.sm },
  stage: { flex: 1 },
  hidden: { display: "none" },
  bottom: { position: "absolute", left: 10, right: 10, gap: 8 },
  frieze: { position: "absolute", left: 0, right: 0 },
  errorCard: { padding: space.md, gap: space.sm },
  error: {
    fontSize: 12,
    color: palette.wax,
    textAlign: "center",
  },
});
