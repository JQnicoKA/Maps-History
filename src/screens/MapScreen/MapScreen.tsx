import type { LngLat, MapRef } from "@maplibre/maplibre-react-native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MissingConfigNotice } from "./MissingConfigNotice";
import { AccountButton } from "./AccountButton";
import { InkButton, Paper, useNotice } from "../../components/ui";
import { WorldMap } from "../../components/WorldMap";
import { env } from "../../config/env";
import { INITIAL_VIEW, MAP_FEATURES } from "../../config/map";
import { useEvents } from "../../features/events/EventsProvider";
import { CharacterMarkers } from "../../features/events/components/CharacterMarkers";
import { EventMarkers } from "../../features/events/components/EventMarkers";
import { EventSummaryCard } from "../../features/events/components/EventSummaryCard";
import { CharacterSummaryCard } from "../../features/events/components/CharacterSummaryCard";
import { LocationReticle } from "../../features/events/components/LocationReticle";
import { FilterButton } from "../../features/filters/FilterButton";
import {
  RegionReticle,
  ShapeBar,
  ShapeOnShow,
  usePlacement,
  type Point,
} from "../../features/placement";
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
import type { Page } from "../Pages";
import { palette } from "../../theme/palette";
import { space } from "../../theme/tokens";

/**
 * The strip kept clear at the very bottom for the map credits.
 *
 * They used to float above the frieze, where they read as one more piece of
 * chrome. Under it they are a colophon: the last line on the plate, out of the
 * way of everything one actually touches.
 *
 * **Plus de zone sûre dans la mesure.** Elle en tenait compte du temps où cet
 * écran occupait tout l'appareil ; la barre d'onglets occupe désormais le bas
 * et porte l'indicateur d'accueil dans son propre rembourrage. Cette scène
 * s'arrête au sommet de la barre, et compter la zone sûre ici la compterait
 * deux fois.
 */
const CREDITS_STRIP = 22;

export type MapScreenProps = {
  /**
   * Demande qu'une page se lève par-dessus les onglets.
   *
   * La carte ne les tient plus : elle en ouvre, comme les trois autres
   * onglets, et c'est la coquille qui les monte — voir `usePages`.
   */
  onRaise: (target: Page) => void;
  /**
   * Dit à la coquille que le crayon a pris la planche.
   *
   * Elle en a besoin pour deux choses qu'elle seule peut faire : effacer la
   * barre d'onglets, et escamoter l'arbre dessiné s'il y en avait un.
   */
  onDrawingChange: (drawing: boolean) => void;
};

export function MapScreen({ onRaise, onDrawingChange }: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapRef>(null);
  const {
    selectedEvent,
    selectedPerson,
    error,
    refresh,
    filters,
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

  /** True from country zoom on, where the fiefs are worth drawing. */
  const [detailed, setDetailed] = useState(false);
  /** The territory the finger last landed on, if its card is open. */
  const [touched, setTouched] = useState<TouchedTerritory | null>(null);
  /** La ville sur laquelle le doigt est tombé, si sa fiche est ouverte. */
  const [touchedPlace, setTouchedPlace] = useState<TouchedPlace | null>(null);
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
    onDrawingChange(drawing);
  }, [drawing, onDrawingChange]);

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

      <View style={styles.stage}>
        <WorldMap
          mapRef={mapRef}
          center={center}
          centerAnimationDuration={hasFramed.current ? 650 : 0}
          /* Zéro des deux côtés depuis que la barre tient le bas : la ligne
             se pose à huit points du bord de cette scène, c'est-à-dire juste
             au-dessus de la barre, et `MapAttribution` ajoute ces huit
             points elle-même. */
          attributionOffset={0}
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
              onOpen={(person) => onRaise({ kind: "person", id: person.id })}
            />
          )}
        </WorldMap>
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
                  onRaise({
                    kind: "entry",
                    of: of === "character" ? "character" : "event",
                    id,
                  })
                }
              />
            </View>
            <FilterButton />
            {/* Un seul bouton reste de ce côté, et c'est un verbe : dessiner
                sur la planche. Les deux autres — ajouter une note, ouvrir ce
                qu'on a déjà — sont devenus des onglets : ils ne portaient pas
                sur la carte mais sur la collection, et une carte n'est pas
                l'endroit où l'on tient l'inventaire de ce qu'on a écrit. */}
            <View style={styles.topRight}>
              {/* Le seul bouton de cette colonne depuis que les deux autres
                  sont devenus des onglets. Il est resté parce qu'il est le
                  seul des trois à porter sur la **planche** : les deux autres
                  ajoutaient à la collection, celui-ci change la carte sur
                  laquelle on la lit. */}
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
              { bottom: CREDITS_STRIP },
            ]}
          >
            <Timeline />
          </View>

          <View
            style={[
              styles.bottom,
              {
                bottom: CREDITS_STRIP + FRIEZE_HEIGHT + space.sm,
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
            {/* Au pied de la planche, ce sur quoi la frise s'est arrêtée —
                un événement, ou quelqu'un. Les flèches s'arrêtent sur les deux
                depuis qu'elles ne sautent plus les personnages ; sans cette
                seconde carte, s'arrêter sur quelqu'un n'aurait rien montré. */}
            {selectedEvent ? (
              <EventSummaryCard
                event={selectedEvent}
                onOpen={() => onRaise({ kind: "event", id: selectedEvent.id })}
              />
            ) : selectedPerson ? (
              <CharacterSummaryCard
                person={selectedPerson}
                onOpen={() => onRaise({ kind: "person", id: selectedPerson.id })}
              />
            ) : null}
          </View>
        </>
      )}

      {/* Les deux fiches que la planche elle-même ouvre : ce que le doigt a
          trouvé dessus. Elles appartiennent à la carte et non à la coquille,
          puisque rien d'autre qu'une touche sur la planche ne les lève. */}
      <TerritorySheet territory={touched} onClose={() => setTouched(null)} />

      <PlaceSheet place={touchedPlace} onClose={() => setTouchedPlace(null)} />
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
  bottom: { position: "absolute", left: 10, right: 10, gap: 8 },
  frieze: { position: "absolute", left: 0, right: 0 },
  errorCard: { padding: space.md, gap: space.sm },
  error: {
    fontSize: 12,
    color: palette.wax,
    textAlign: "center",
  },
});
