import type { LngLat, MapRef } from "@maplibre/maplibre-react-native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MissingConfigNotice } from "./MissingConfigNotice";
import { AccountButton } from "./AccountButton";
import { InkButton, Paper, useNotice } from "../../components/ui";
import { ParchmentOverlay, WorldMap } from "../../components/WorldMap";
import { env } from "../../config/env";
import { INITIAL_VIEW, MAP_FEATURES } from "../../config/map";
import { useEvents } from "../../features/events/EventsProvider";
import type { HistoricalEvent } from "../../features/events/types";
import {
  NewNoteButton,
  type Note,
} from "../../features/events/components/NewNoteButton";
import {
  PeopleButton,
  PeopleSheet,
  type PeopleTab,
} from "../../features/events/components/PeopleSheet";
import { EventDetailModal } from "../../features/events/components/EventDetailModal";
import { EventFormModal } from "../../features/events/components/EventFormModal";
import { CollectionListView } from "../../features/events/components/CollectionListView";
import { CharacterDetailModal } from "../../features/events/components/CharacterDetailModal";
import { CharacterEditModal } from "../../features/events/components/CharacterEditModal";
import { CharacterMarkers } from "../../features/events/components/CharacterMarkers";
import { EventMarkers } from "../../features/events/components/EventMarkers";
import { TreeBuilder } from "../../features/genealogy/TreeBuilder";
import { EventSummaryCard } from "../../features/events/components/EventSummaryCard";
import { LocationReticle } from "../../features/events/components/LocationReticle";
import { FilterButton } from "../../features/filters/FilterButton";
import type { ScreenView } from "../../features/filters/view";
import {
  RegionReticle,
  ShapeBar,
  ShapeOnShow,
  usePlacement,
  type Point,
} from "../../features/placement";
import { Catalogue } from "../../features/community/Catalogue";
import {
  CHARACTER_LOOK,
  EVENT_LOOK,
  TREE_LOOK,
} from "../../features/community/looks";
import {
  PlaceLayers,
  type TouchedPlace,
} from "../../features/places/PlaceLayers";
import { PlaceSheet } from "../../features/places/PlaceSheet";
import { useMyPlaces } from "../../features/places/MyPlacesProvider";
import {
  NamePlaceDialog,
  type NamedPlace,
} from "../../features/places/NamePlaceDialog";
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
  | { kind: "searchTrees" }
  /**
   * Le catalogue ouvert d'emblée sur une entrée, carte en avant.
   *
   * Pour « Voir » : une notification ou le formulaire d'un exemplaire en
   * retard mène à la version que la bibliothèque a corrigée, et c'est elle
   * qui porte le bouton de reprise. `of` dit dans quel catalogue chercher.
   */
  | { kind: "entry"; of: "event" | "character"; id: string };

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
  const { aiming, asking, place, settle, looking } = usePlacement();
  /**
   * How much of a metre a screen point is worth, where the plate is looking.
   *
   * Web Mercator: 156 543 metres to a pixel at the equator at zoom zero,
   * halved at every zoom and narrowed by the cosine of the latitude. The
   * region reticle needs it to draw a radius in metres as a circle in points.
   */
  const [pointsPerMetre, setPointsPerMetre] = useState<number | null>(null);
  /**
   * L'échelle à laquelle la planche est lue.
   *
   * Tenue pour les villes, qui s'en servent pour savoir laquelle le doigt a
   * le droit de trouver. Tenue ici parce que c'est l'écran qui écoute la
   * carte, et gratuite : `onLook` provoquait déjà un rendu à chaque geste.
   */
  const [zoom, setZoom] = useState<number>(INITIAL_VIEW.zoom);
  /** The reach being set, while the region reticle is up. */
  const [reach, setReach] = useState(500_000);
  // The opening shot should not fly across the world; every later move should.
  const hasFramed = useRef(false);

  const [view, setView] = useState<ScreenView>("map");
  /** La feuille du formulaire d'événement : écrire, ou corriger. */
  const [composing, setComposing] = useState(false);
  /**
   * Combien de fois le `+` a demandé un formulaire vierge, ce qui le clé.
   *
   * La feuille ne se vide d'elle-même qu'à « Annuler » et à l'enregistrement.
   * Quittée en la faisant glisser vers le bas, elle garde ce qui était tapé —
   * et c'est heureux pour un geste accidentel. Mais `+` veut dire *nouveau* :
   * compter les demandes change la clé, donc remonte la feuille, donc la
   * reseme à blanc. Les deux comportements tiennent ensemble.
   */
  const [drafts, setDrafts] = useState(0);
  /** Celle des personnages et des arbres, et laquelle de ses deux moitiés. */
  const [peopling, setPeopling] = useState(false);
  const [peopleTab, setPeopleTab] = useState<PeopleTab>("character");
  const [editing, setEditing] = useState<HistoricalEvent | null>(null);
  /** True from country zoom on, where the fiefs are worth drawing. */
  const [detailed, setDetailed] = useState(false);
  /** The territory the finger last landed on, if its card is open. */
  const [touched, setTouched] = useState<TouchedTerritory | null>(null);
  /** La ville sur laquelle le doigt est tombé, si sa fiche est ouverte. */
  const [touchedPlace, setTouchedPlace] = useState<TouchedPlace | null>(null);
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
   * A destination rather than a flag, because there are two of them: the
   * people sheet a page was asked for from, and the tree a page was reached
   * from. Set once at the start of a journey and honoured at its end, so
   * reading three people in a row is three taps and not three journeys.
   *
   * La feuille du formulaire d'événement n'y figure pas : elle n'ouvre plus
   * aucune page depuis que la fourche et les deux listes l'ont quittée.
   */
  const [back, setBack] = useState<Page | { sheet: PeopleTab } | null>(null);
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

  /** The same, from the people sheet, which is what has to go down first. */
  const afterSheet = (deed: () => void, tab: PeopleTab = "character") => {
    setNext(() => deed);
    setBack({ sheet: tab });
    setPeopling(false);
  };

  /** Called by every page and by the people sheet, once off the screen. */
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
      // Elle revient sur la moitié qu'on a quittée, et non sur l'autre.
      setPeopleTab(back.sheet);
      setPeopling(true);
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
  /**
   * L'arbre à dessiner — celui qu'on lit, ou celui qu'on vient de quitter.
   *
   * La seconde moitié compte autant que la première. Quitter l'arbre pour une
   * page suspendait son dessin, et le temps que la modale monte on voyait la
   * carte derrière : l'impression que l'arbre s'était refermé alors qu'on
   * allait y revenir.
   *
   * Il n'avait pourtant aucune raison de partir. Un arbre est une vue opaque
   * posée sur la carte, pas une modale ; les pages, elles, en sont, et une
   * modale se lève par-dessus tout. Le laisser dessiné ne viole donc pas la
   * règle d'iOS — c'est le `page` unique qui l'escamotait, faute de pouvoir
   * tenir deux choses à la fois.
   *
   * `back` tient exactement l'information manquante : il vaut cet arbre quand
   * et seulement quand on compte y revenir. Ouvrir *un autre* arbre ne pose
   * pas de retour, et l'ancien s'efface bien.
   */
  const treeId =
    page?.kind === "tree"
      ? page.id
      : back !== null && "kind" in back && back.kind === "tree"
        ? back.id
        : null;
  const shownTree =
    treeId === null ? null : (trees.find((one) => one.id === treeId) ?? null);

  const { draw } = useHidden();
  const { add: addPlace } = useMyPlaces();
  /**
   * Le point qu'on vient de viser, pendant qu'on nomme la ville qui s'y pose.
   *
   * Une ville se nomme après avoir visé et non avant, comme un territoire se
   * nomme après avoir été peint : on sait ce qu'on vient de poser, on ne sait
   * pas encore ce qu'on va poser.
   */
  const [posing, setPosing] = useState<Point | null>(null);
  const [posingSaving, setPosingSaving] = useState(false);
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

  /**
   * Donne la carte au viseur, puis demande son nom à ce qu'on y a posé.
   *
   * Deux temps et non un : le viseur rend un point ou rien du tout, et le
   * lecteur qui renonce en chemin ne doit pas se retrouver devant un
   * formulaire à remplir sur une ville qu'il n'a pas posée.
   */
  const poseAPlace = async () => {
    const spot = await place();
    if (spot) setPosing(spot);
  };

  /** Garde la ville à l'endroit visé, sous le nom et les années données. */
  const keepPlace = async (named: NamedPlace) => {
    const spot = posing;
    if (!spot) return;
    setPosingSaving(true);
    try {
      await addPlace({
        name: named.name,
        longitude: spot.longitude,
        latitude: spot.latitude,
        from: named.from,
        to: named.to,
      });
      setPosing(null);
    } catch (cause) {
      sayMap(
        "Ville non enregistrée",
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setPosingSaving(false);
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

  /**
   * Anything done *to* the plate brings the plate up first.
   *
   * Aiming at a map one cannot see is not aiming, and neither is painting on
   * one: the brush would have laid its strokes over the list. Both are asked
   * for from panels that can be opened in either view, so the switch belongs
   * here rather than at each of the places that start them.
   */
  useEffect(() => {
    if (aiming || drawing) setView("map");
  }, [aiming, drawing]);

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
            setZoom(zoom);
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
          {MAP_FEATURES.places ? (
            <PlaceLayers
              zoom={zoom}
              // Pas pendant qu'on vise ou qu'on peint : chaque touche
              // appartient à cela, et le viseur est ce avec quoi on vise.
              onTouch={aiming || drawing ? undefined : setTouchedPlace}
            />
          ) : null}
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
          {/* Somebody else's territory, offered for a look. Above the washes
              of the map itself, since it is a proposal and not yet part of
              the world. */}
          {asking?.kind === "shape" ? (
            <ShapeOnShow shape={asking.shape} />
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
        <CollectionListView
          onOpenEvent={() => {
            if (selectedEvent) raise({ kind: "event", id: selectedEvent.id });
          }}
          onOpenPerson={(id) => raise({ kind: "person", id })}
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

      {asking?.kind === "shape" ? (
        <ShapeBar
          name={asking.name}
          said={asking.said}
          take={asking.take}
          takeable={asking.takeable}
          busy={false}
          onTake={() => settle(true)}
          onClose={() => settle(false)}
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

      <NamePlaceDialog
        // Remonté à chaque pose, pour que les champs soient vierges : la
        // fenêtre tient son brouillon, et la ville d'avant y serait restée.
        key={`place-${posing?.longitude ?? "none"}-${posing?.latitude ?? ""}`}
        visible={posing !== null}
        busy={posingSaving}
        onConfirm={(named) => void keepPlace(named)}
        onClose={() => setPosing(null)}
      />

      {aiming || drawing ? null : (
        <>
          <View
            style={[styles.top, { top: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <View style={styles.topLeft}>
              <AccountButton
                onSeeEntry={(of, id) =>
                  // Déjà baissée : `AccountButton` attend son `onClosed`
                  // avant d'appeler ceci.
                  raise({
                    kind: "entry",
                    of: of === "character" ? "character" : "event",
                    id,
                  })
                }
              />
            </View>
            <FilterButton view={view} onViewChange={setView} />
            {/* Trois boutons, trois verbes : ajouter une note, ouvrir ce
                qu'on a déjà, dessiner sur la planche. Ils tenaient autrefois
                chacun un genre — événements, personnages, territoires — en
                miroir des trois calques du filtre, et c'était une parenté
                fausse : on y créait et on y consultait à la fois, dans le même
                panneau, sans que rien ne dise lequel des deux on faisait. */}
            <View style={styles.topRight}>
              <NewNoteButton
                onCreate={(what: Note) => {
                  if (what === "event") {
                    setEditing(null);
                    setDrafts((count) => count + 1);
                    setComposing(true);
                    return;
                  }
                  // Le formulaire d'un personnage est une page et non une
                  // feuille : placer quelqu'un donne l'écran entier au viseur.
                  raise({ kind: "editPerson", id: null });
                }}
                onSeek={(what: Note) =>
                  raise({
                    kind:
                      what === "event" ? "searchEvents" : "searchCharacters",
                  })
                }
              />
              <PeopleButton
                onPress={() => {
                  setPeopleTab("character");
                  setPeopling(true);
                }}
              />
              {/* Sous les deux autres, et à part : elles ajoutent à la
                  collection, celui-ci change la carte qu'on la lit sur. */}
              {MAP_FEATURES.territories ? (
                <DrawTerritoryButton
                  onDraw={() => setDrawing(true)}
                  onPose={() => void poseAPlace()}
                />
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
        // Remounting re-seeds every field: on the event being edited, or on
        // the number of blank forms asked for — see `drafts`.
        key={editing?.id ?? `new-${drafts}`}
        visible={composing}
        event={editing}
        // Descendre d'abord, ouvrir ensuite : `onClosed` lève la fiche une
        // fois cette feuille réellement partie.
        onSeeEntry={(id) => {
          setNext(() => () => raise({ kind: "entry", of: "event", id }));
          setComposing(false);
          setEditing(null);
        }}
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

      {/* Ce que la collection connaît déjà : les gens, et les lignées. */}
      <PeopleSheet
        visible={peopling}
        tab={peopleTab}
        onTabChange={setPeopleTab}
        // Down, then up: the panel is raised by `onClosed`, once this sheet
        // has actually gone.
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
        onSeekCharacter={() =>
          afterSheet(() => raise({ kind: "searchCharacters" }), "character")
        }
        onSeekTree={() =>
          afterSheet(() => raise({ kind: "searchTrees" }), "tree")
        }
        onClose={() => setPeopling(false)}
        onClosed={afterPage}
      />

      <TerritorySheet territory={touched} onClose={() => setTouched(null)} />

      <PlaceSheet place={touchedPlace} onClose={() => setTouchedPlace(null)} />

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
        onSeeEntry={(id) =>
          after(() => raise({ kind: "entry", of: "character", id }))
        }
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
      {/* Les deux mêmes panneaux servent la recherche et le « Voir » d'une
          entrée corrigée : c'est le même catalogue, ouvert sur la liste ou
          sur une carte. En monter un second pour cela aurait fait deux
          exemplaires du même écran à tenir en phase. */}
      <Catalogue
        key={`commons-events-${raised}`}
        kind="event"
        look={EVENT_LOOK}
        visible={
          page?.kind === "searchEvents" ||
          (page?.kind === "entry" && page.of === "event")
        }
        open={page?.kind === "entry" && page.of === "event" ? page.id : null}
        onClose={() => setPage(null)}
        onClosed={afterPage}
      />

      <Catalogue
        key={`commons-people-${raised}`}
        kind="character"
        look={CHARACTER_LOOK}
        visible={
          page?.kind === "searchCharacters" ||
          (page?.kind === "entry" && page.of === "character")
        }
        open={
          page?.kind === "entry" && page.of === "character" ? page.id : null
        }
        onClose={() => setPage(null)}
        onClosed={afterPage}
      />

      <Catalogue
        key={`commons-trees-${raised}`}
        kind="tree"
        look={TREE_LOOK}
        visible={page?.kind === "searchTrees"}
        onClose={() => setPage(null)}
        onClosed={afterPage}
      />

      {/* The one drawing, wherever it was asked for: the tree list in the
          people sheet, or someone's page saying they stand in it. Mounted
          here because it carries pages of its own, which cannot be panels
          inside a panel inside a panel. */}
      <TreeBuilder
        // Sur l'arbre lui-même, et non sur le compteur de levées : celui-ci
        // sert à re-semer un *panneau* à chaque fois qu'on le lève, ce qui
        // n'a pas de sens pour une vue qui doit rester en place pendant
        // qu'une page la survole. Changer d'arbre remonte le dessin ;
        // revenir au même le retrouve où on l'avait laissé, panoramique et
        // échelle compris.
        key={`tree-${shownTree?.id ?? "none"}`}
        tree={shownTree}
        // Le dessin s'ôte quand la carte redevient le contrôle. Sans quoi,
        // créer quelqu'un depuis un arbre menait à viser un point sur une
        // carte que l'arbre recouvrait — il fallait fermer l'arbre pour
        // l'atteindre, ce qui défaisait tout l'intérêt de l'avoir gardé.
        hidden={aiming || drawing}
        // L'arbre reste dessiné pendant qu'une page le survole, donc il ne
        // peut pas savoir seul qu'on lui est revenu. Ceci le lui dit, et il
        // en profite pour rouvrir la fenêtre d'ajout là où on l'avait
        // laissée — le détour avait un but, on le reprend où il s'arrêtait.
        active={page?.kind === "tree"}
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
        // Les deux portes de la fenêtre « Ajouter à cette génération ». Même
        // aller-retour que les trois au-dessus : l'arbre se referme, la page
        // s'ouvre, et refermer la page relève l'arbre là où on l'avait
        // laissé — avec le nouveau venu désormais dans la liste.
        onNewPerson={() =>
          leaveTree((treeId) => {
            setBack({ kind: "tree", id: treeId });
            raise({ kind: "editPerson", id: null });
          })
        }
        onSeekPerson={() =>
          leaveTree((treeId) => {
            setBack({ kind: "tree", id: treeId });
            raise({ kind: "searchCharacters" });
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
