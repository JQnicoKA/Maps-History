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
import type { HistoricalEvent } from "../../features/events/types";
import type { Tab } from "../../features/events/components/EventFormModal";
import {
  AddEventButton,
  AddPersonButton,
} from "../../features/events/components/AddEventButton";
import { EventDetailModal } from "../../features/events/components/EventDetailModal";
import { EventFormModal } from "../../features/events/components/EventFormModal";
import { EventListView } from "../../features/events/components/EventListView";
import { CharacterDetailModal } from "../../features/events/components/CharacterDetailModal";
import { CharacterEditModal } from "../../features/events/components/CharacterEditModal";
import { CharacterMarkers } from "../../features/events/components/CharacterMarkers";
import { EventMarkers } from "../../features/events/components/EventMarkers";
import { TreeBuilder } from "../../features/genealogy/TreeBuilder";
import { EventSummaryCard } from "../../features/events/components/EventSummaryCard";
import { LocationReticle } from "../../features/events/components/LocationReticle";
import { FilterButton } from "../../features/filters/FilterButton";
import { RegionReticle, usePlacement } from "../../features/placement";
import { Catalogue } from "../../features/community/Catalogue";
import {
  CHARACTER_LOOK,
  EVENT_LOOK,
  FOLDER_LOOK,
} from "../../features/community/looks";
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

/**
 * A page open over the map: an event, a person, the form on a person, a tree.
 *
 * One state rather than four flags, because only one is ever up — and four
 * independent flags would have allowed the pairs iOS refuses to present at
 * once. Everything is held by id and looked up as it is drawn, so a page does
 * not go stale behind an edit made on top of it.
 */
type Page =
  | { kind: "event"; id: string }
  | { kind: "person"; id: string }
  /** `null` invents one. */
  | { kind: "editPerson"; id: string | null }
  | { kind: "tree"; id: string }
  /** The community catalogue, which is about no one row in particular. */
  | { kind: "searchEvents" }
  | { kind: "searchCharacters" }
  | { kind: "searchFolders" };

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapRef>(null);
  const {
    selectedEvent,
    error,
    refresh,
    filters,
    events,
    characters,
    trees,
    selectEvent,
  } = useEvents();
  const { aiming, asking, settle, looking } = usePlacement();
  /**
   * How much of a metre a screen point is worth, where the plate is looking.
   *
   * Web Mercator: 156 543 metres to a pixel at the equator at zoom zero,
   * halved at every zoom and narrowed by the cosine of the latitude. The
   * region reticle needs it to draw a radius in metres as a circle in points.
   */
  const [pointsPerMetre, setPointsPerMetre] = useState<number | null>(null);
  /** The reach being set, while the region reticle is up. */
  const [reach, setReach] = useState(500_000);
  // The opening shot should not fly across the world; every later move should.
  const hasFramed = useRef(false);

  const [view, setView] = useState<ScreenView>("map");
  const [composing, setComposing] = useState(false);
  /** Which pair of tabs the sheet opens on. */
  const [family, setFamily] = useState<"event" | "people">("event");
  /**
   * And which of the pair, when the sheet is being brought back.
   *
   * Set at the moment of the return and never before. It feeds the sheet's
   * key, and changing a key remounts: written while the sheet was on its way
   * out, it tore the panel from the tree mid-slide, `onClosed` never fired,
   * and the page it was meant to hand over to never came up — the reader was
   * left on the map.
   */
  const [sheetTab, setSheetTab] = useState<Tab | undefined>(undefined);
  const [editing, setEditing] = useState<HistoricalEvent | null>(null);
  /** True from country zoom on, where the fiefs are worth drawing. */
  const [detailed, setDetailed] = useState(false);
  /** The territory the finger last landed on, if its card is open. */
  const [touched, setTouched] = useState<TouchedTerritory | null>(null);
  /**
   * Which page is open, if any.
   *
   * They live here, at the top of the screen and never inside one another:
   * the person form hands the whole screen to the reticle when someone is
   * placed, and a panel nested in another would be torn down along with it.
   */
  const [page, setPage] = useState<Page | null>(null);
  /**
   * What to do once the page now leaving is off the screen.
   *
   * iOS refuses to present from a controller that is still dismissing, so
   * every hand-over — a name on an event, an event on a person's page, the
   * pencil in a list — lowers one page, waits for `onClosed`, and only then
   * raises the next. Guessing at a delay is what this replaces.
   */
  const [next, setNext] = useState<(() => void) | null>(null);
  /**
   * Where to go back to when the page now showing closes.
   *
   * A destination rather than a flag, because there are two of them: the add
   * sheet a page was asked for from, and the tree a page was reached from.
   * Set once at the start of a journey and honoured at its end, so reading
   * three people in a row is three taps and not three journeys.
   */
  const [back, setBack] = useState<Page | { sheet: Tab } | null>(null);
  /**
   * How many pages have been raised, which is what keys them.
   *
   * Not the subject's id: that falls away the moment a page is dismissed, and
   * a remount there would tear the sheet out mid-slide — the very thing
   * `useLingering` holds it together for. Counting the raisings keys a page
   * on the one event that should re-seed it, and on nothing else.
   */
  const [raised, setRaised] = useState(0);

  /** Puts a page up over whatever is showing. */
  const raise = (target: Page) => {
    setPage(target);
    setRaised((count) => count + 1);
  };

  /**
   * Lowers the page that is up and does this once it has gone.
   *
   * `setNext` is handed a function that *returns* the deed: React would
   * otherwise call a function given to a setter as an updater.
   */
  const after = (deed: () => void) => {
    setNext(() => deed);
    setPage(null);
  };

  /** The same, from the add sheet, which is what has to go down first. */
  const afterSheet = (deed: () => void, tab: Tab = "character") => {
    setNext(() => deed);
    // The tab travels inside the destination rather than being written now:
    // see `sheetTab` for what writing it now used to cost.
    setBack({ sheet: tab });
    setComposing(false);
  };

  /** Called by every page and by the add sheet, once off the screen. */
  const afterPage = () => {
    if (next) {
      const deed = next;
      setNext(null);
      deed();
      return;
    }
    if (back === null) return;
    setBack(null);
    if ("sheet" in back) {
      setSheetTab(back.sheet);
      // The tab says which pair it belongs to; the sheet must come back
      // showing the half the reader left from, not the other one.
      setFamily(
        back.sheet === "character" || back.sheet === "tree"
          ? "people"
          : "event",
      );
      setComposing(true);
      return;
    }
    raise(back);
  };

  /**
   * Takes the drawing off the screen and does this, told which one it was.
   *
   * No waiting: the tree is a plain view over the map, so it is gone as soon
   * as the state says so. The card that asked for this has already finished
   * leaving — that one *is* a panel, and `TreeBuilder` waits for it.
   */
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
  const shownTree =
    page?.kind === "tree"
      ? (trees.find((one) => one.id === page.id) ?? null)
      : null;

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
  const center = useMemo<LngLat | undefined>(() => {
    // A zone being changed opens where it already is: asking somebody to pan
    // back to the circle they set last week is asking them to set it again.
    if (asking?.kind === "zone" && asking.from) {
      return [asking.from.longitude, asking.from.latitude];
    }
    return selectedEvent
      ? [selectedEvent.longitude, selectedEvent.latitude]
      : undefined;
  }, [asking, selectedEvent]);

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

  /** Answers the region question with the crosshair and the reach set here. */
  const confirmRegion = useCallback(async () => {
    const centre = await mapRef.current?.getCenter();
    settle(
      centre
        ? { longitude: centre[0], latitude: centre[1], metres: reach }
        : null,
    );
  }, [settle, reach]);

  // Aiming at a map one cannot see is not aiming. A placement asked for from
  // the list view brings the plate up first.
  useEffect(() => {
    if (aiming) setView("map");
  }, [aiming]);

  // The reticle opens on the reach the filter already had, and on the plate
  // the reader is looking at when it has none.
  useEffect(() => {
    if (asking?.kind === "zone") setReach(asking.metres);
  }, [asking]);

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
          onLook={(centre, zoom) => {
            looking.current = centre;
            const metresPerPoint =
              (156543.03392 * Math.cos((centre.latitude * Math.PI) / 180)) /
              2 ** zoom;
            setPointsPerMetre(metresPerPoint === 0 ? null : 1 / metresPerPoint);
          }}
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
          {drawing ? null : (
            <CharacterMarkers
              onOpen={(person) => raise({ kind: "person", id: person.id })}
            />
          )}
        </WorldMap>
      </View>

      <View style={[styles.stage, view === "list" ? null : styles.hidden]}>
        <EventListView
          onOpen={() => {
            if (selectedEvent) raise({ kind: "event", id: selectedEvent.id });
          }}
          contentPadding={{
            top: insets.top + 62,
            bottom: insets.bottom + 82,
          }}
        />
        <ParchmentOverlay />
      </View>

      {mapDialog}

      {asking?.kind === "point" ? (
        <LocationReticle
          onConfirm={() => void confirmPlacement()}
          onCancel={() => settle(null)}
          bottomInset={insets.bottom}
        />
      ) : null}

      {asking?.kind === "zone" ? (
        <RegionReticle
          metres={reach}
          onMetresChange={setReach}
          pointsPerMetre={pointsPerMetre}
          onConfirm={() => void confirmRegion()}
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
                  setSheetTab(undefined);
                  setComposing(true);
                }}
              />
              <AddPersonButton
                onPress={() => {
                  setEditing(null);
                  setFamily("people");
                  setSheetTab(undefined);
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
                onOpen={() => {
            if (selectedEvent) raise({ kind: "event", id: selectedEvent.id });
          }}
              />
            ) : null}
          </View>
        </>
      )}

      <EventFormModal
        // Remounting re-seeds every field — on the event being edited, and on
        // the family, whose first tab decides what the sheet opens on.
        key={editing?.id ?? `new-${family}-${sheetTab ?? "first"}`}
        family={family}
        startOn={sheetTab}
        visible={composing}
        event={editing}
        // Down, then up: the panel is raised by `onClosed` below, once this
        // sheet has actually gone.
        onReadCharacter={(person) =>
          afterSheet(() => raise({ kind: "person", id: person.id }))
        }
        onEditCharacter={(target) =>
          afterSheet(() =>
            raise({
              kind: "editPerson",
              id: target === "new" ? null : target.id,
            }),
          )
        }
        onOpenTree={(id) =>
          afterSheet(() => raise({ kind: "tree", id }), "tree")
        }
        onSearch={() =>
          afterSheet(() => raise({ kind: "searchEvents" }), "event")
        }
        onSearchPeople={() =>
          afterSheet(() => raise({ kind: "searchCharacters" }), "character")
        }
        onSearchFolders={() =>
          afterSheet(() => raise({ kind: "searchFolders" }), "folder")
        }
        onClosed={afterPage}
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

      {/* Someone's page: what a tap asks for, on the plate, on a row, and on
          a name in an event's cast. Every way in leads here, so a face on the
          map is a way into the collection and not a dead end. */}
      <CharacterDetailModal
        key={`page-${raised}`}
        person={shownPerson}
        onEdit={(person) =>
          after(() => raise({ kind: "editPerson", id: person.id }))
        }
        onOpenEvent={(id) =>
          after(() => {
            // The map follows what is being read: the frieze, the markers and
            // the card at the foot of the screen would otherwise all be
            // showing a different year from the page on top of them.
            selectEvent(id);
            raise({ kind: "event", id });
          })
        }
        onOpenTree={(id) => after(() => raise({ kind: "tree", id }))}
        onClose={() => setPage(null)}
        onClosed={afterPage}
      />

      {/* The form, reached by the pencil in the list or "Modifier" on the
          page. Keyed on the raising, whose details seed its fields. */}
      <CharacterEditModal
        key={`form-${raised}`}
        target={edited}
        onClose={() => setPage(null)}
        onClosed={afterPage}
      />

      <EventDetailModal
        key={`event-${raised}`}
        event={shownEvent}
        // The sheet hands over the event it has read whole; the form is
        // never seeded from the summary the map holds.
        onEdit={(whole) =>
          after(() => {
            setEditing(whole);
            setComposing(true);
          })
        }
        onOpenCharacter={(id) => after(() => raise({ kind: "person", id }))}
        onClose={() => setPage(null)}
        onClosed={afterPage}
      />

      {/* Everybody else's work. A page like the others, at the top of the
          screen, so what it opens is never a panel inside a panel. */}
      <Catalogue
        key={`commons-events-${raised}`}
        kind="event"
        look={EVENT_LOOK}
        visible={page?.kind === "searchEvents"}
        onClose={() => setPage(null)}
        onClosed={afterPage}
      />

      <Catalogue
        key={`commons-people-${raised}`}
        kind="character"
        look={CHARACTER_LOOK}
        visible={page?.kind === "searchCharacters"}
        onClose={() => setPage(null)}
        onClosed={afterPage}
      />

      <Catalogue
        key={`commons-folders-${raised}`}
        kind="folder"
        look={FOLDER_LOOK}
        visible={page?.kind === "searchFolders"}
        onClose={() => setPage(null)}
        onClosed={afterPage}
      />

      {/* The one drawing, wherever it was asked for: the tree list in the
          people sheet, or someone's page saying they stand in it. Mounted
          here because it carries pages of its own, which cannot be panels
          inside a panel inside a panel. */}
      <TreeBuilder
        key={`tree-${raised}`}
        tree={shownTree}
        // A screen rather than a panel, so there is no dismissal to wait for:
        // it is gone the moment the state says so, and whatever is owed —
        // the sheet it was opened from, the page it was left for — may be
        // raised in the same breath.
        onClose={() => {
          setPage(null);
          afterPage();
        }}
        // Each of these leaves the tree. The tree is remembered as the way
        // back, so closing the page it opens brings the drawing up again
        // where the reader left it.
        onOpenEvent={(id) =>
          leaveTree((treeId) => {
            selectEvent(id);
            setBack({ kind: "tree", id: treeId });
            raise({ kind: "event", id });
          })
        }
        onOpenTree={(id) =>
          // No way back here: the reader asked for another tree, not for a
          // detour out of this one.
          leaveTree(() => raise({ kind: "tree", id }))
        }
        onEditPerson={(id) =>
          leaveTree((treeId) => {
            setBack({ kind: "tree", id: treeId });
            raise({ kind: "editPerson", id });
          })
        }
      />
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
