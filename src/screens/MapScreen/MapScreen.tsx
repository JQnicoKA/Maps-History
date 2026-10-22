import type { LngLat, MapRef } from "@maplibre/maplibre-react-native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MissingConfigNotice } from "./MissingConfigNotice";
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
  StudyBoard,
  StudyButton,
  StudyMarker,
  StudyShape,
  useStudyFraming,
  useStudySession,
} from "../../features/study";
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
import {
  BRUSH_POINTS,
  brushMercator,
  brushMetres,
  metresPerPoint,
} from "../../features/territories/brush";
import {
  DrawPolityBar,
  type Tool,
} from "../../features/territories/DrawPolityBar";
import { rub } from "../../features/territories/rubber";
import { DrawTerritoryButton } from "../../features/territories/DrawTerritoryButton";
import { useHidden } from "../../features/territories/HiddenProvider";
import {
  NamePolityDialog,
  type NamedPolity,
} from "../../features/territories/NamePolityDialog";
import {
  fetchStrokes,
  type Daub,
  type DrawnPolity,
  type Stroke,
} from "../../features/territories/drawn";
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
 * **Vingt-deux points, et rien de plus.** La barre d'onglets est ancrée sous
 * cette scène et prend sa place dans la colonne : la planche s'arrête d'elle-
 * même à son sommet, et il n'y a donc que la ligne de crédits à mesurer ici.
 * La barre a flotté un temps, et il fallait alors y ajouter sa hauteur, sa
 * marge et la zone sûre — une mesure calculée dans la coquille et descendue
 * jusqu'ici, que la frise a payée deux fois avant qu'on la retire.
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
  /**
   * Dit à la coquille qu'une étude a pris la planche.
   *
   * Le même office que `onDrawingChange`, et pour la même raison : la barre
   * d'onglets doit s'effacer. Une prop séparée plutôt qu'un « quelque chose
   * a pris l'écran » parce que la coquille fait des choses différentes des
   * deux — le crayon escamote aussi l'arbre dessiné, l'étude non.
   */
  onStudyingChange: (studying: boolean) => void;
};

/**
 * Le milieu de la boîte qui contient tout le tracé.
 *
 * Le centre de la boîte plutôt que la moyenne des points : un trait très
 * fourni d'un côté tirerait la moyenne vers lui, et la carte s'ouvrirait de
 * travers sur le territoire qu'on vient de rouvrir.
 */
function middleOf(strokes: Daub[]): LngLat | null {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const daub of strokes) {
    for (const [lon, lat] of daub.points) {
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  if (west === Infinity) return null;
  return [(west + east) / 2, (south + north) / 2];
}

export function MapScreen({
  onRaise,
  onDrawingChange,
  onStudyingChange,
}: MapScreenProps) {
  /**
   * La séance d'étude, et le cadrage qu'elle demande.
   *
   * Tenue ici et non dans un fournisseur : une étude est un geste **sur la
   * planche**, comme le crayon, et elle ne survit pas à la quitter. Rien
   * d'autre que cet écran n'a à la connaître.
   */
  const study = useStudySession();
  const framing = useStudyFraming(study);
  const studying = study.live;

  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapRef>(null);
  const {
    selectedEvent,
    selectedPerson,
    dismissTile,
    tileDismissed,
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
  /**
   * La planche n'a pas pu charger son style — voir `WorldMap`.
   *
   * Distinct de l'erreur de la collection : l'une laisse une carte sans
   * fond, l'autre un fond sans rien dessus, et le lecteur a besoin de savoir
   * laquelle des deux il regarde.
   */
  const [styleFailed, setStyleFailed] = useState(false);
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
  const [strokes, setStrokes] = useState<Daub[]>([]);
  /**
   * Le territoire qu'on reprend, s'il y en a un.
   *
   * Dessiner et reprendre sont le même geste au même endroit : seuls le
   * tracé de départ et la destination de l'enregistrement changent. Le
   * garder ici plutôt que d'ouvrir un second mode évite d'écrire deux fois
   * le pinceau.
   */
  const [editing, setEditing] = useState<DrawnPolity | null>(null);
  /** Où amener la planche, quand on y reprend un dessin. */
  const [lookAt, setLookAt] = useState<LngLat | null>(null);
  const [trail, setTrail] = useState<Stroke>([]);
  const [naming, setNaming] = useState(false);
  /** Pinceau, gomme ou main : ce qu'un doigt fait en ce moment. */
  const [tool, setTool] = useState<Tool>("brush");
  const [saving, setSaving] = useState(false);
  const { say: sayMap, dialog: mapDialog } = useNotice();

  const stopDrawing = () => {
    setDrawing(false);
    setStrokes([]);
    setTrail([]);
    setNaming(false);
    setTool("brush");
    setEditing(null);
    setLookAt(null);
  };

  /**
   * Jusqu'où la gomme emporte, en mètres de Mercator.
   *
   * La somme des deux rayons — celui du pinceau et celui de la gomme, égaux
   * ici : c'est la distance à laquelle leurs disques se touchent, donc celle
   * sous laquelle un point de trait doit tomber. La bande effacée fait alors
   * la largeur du pinceau, ce qui est la seule mesure que la main connaisse.
   */
  const bite = 2 * brushMercator(zoom);

  /**
   * Ce que la gomme est en train d'ôter, montré pendant qu'elle le fait.
   *
   * La même fonction que celle qui coupera pour de bon quand le doigt se
   * lèvera — appliquée au trait en cours plutôt qu'à un trait fini. L'aperçu
   * ne promet donc rien : il montre le résultat, calculé par le même code.
   */
  const shown =
    tool === "eraser" && trail.length > 0
      ? rub(strokes, trail, bite)
      : strokes;

  /** Le coup qu'on vient de donner : il ajoute, ou il retranche. */
  /**
   * Reprendre un territoire : recharger son tracé et rendre la main au
   * pinceau.
   *
   * La carte se recentre dessus, mais sans toucher au zoom : chaque trait se
   * dessine à sa vraie largeur au sol — voir `BrushLayers` —, donc le dessin
   * est fidèle à n'importe quelle échelle. Il n'y a rien à restaurer.
   */
  const editShape = async (territory: DrawnPolity) => {
    try {
      const kept = await fetchStrokes(territory.id);
      if (kept === null || kept.length === 0) {
        throw new Error("le tracé de ce territoire n'a pas été gardé");
      }
      setStrokes(kept);
      setEditing(territory);
      /* Le milieu de ce qui a été peint, et non le centre du polygone : il
         se lit dans le tracé qu'on vient de recevoir, sans rien demander de
         plus à la base ni au dessin. */
      setLookAt(middleOf(kept));
      setTool("brush");
      setDrawing(true);
    } catch (cause) {
      sayMap(
        "Territoire non repris",
        cause instanceof Error ? cause.message : String(cause),
      );
    }
  };

  const lay = (stroke: Stroke) => {
    if (tool === "eraser") {
      setStrokes((current) => rub(current, stroke, bite));
      return;
    }
    /* La largeur est prise maintenant, à la latitude où le doigt a commencé.
       Prise à l'enregistrement, le zoom du moment où l'on appuie sur
       « Terminer » aurait décidé pour tous les coups à la fois. */
    const metres = brushMetres(zoom, stroke[0]?.[1] ?? 0);
    setStrokes((current) => [...current, { points: stroke, metres }]);
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
      /* Plus rien à mesurer ici : chaque coup est entré dans la liste à la
         largeur qu'il avait — voir `lay`. Le zoom du moment où l'on termine
         ne décide donc plus de la forme du territoire. */
      await draw({
        strokes,
        name: named.name,
        from: named.from,
        to: named.to,
        existing: editing?.id ?? null,
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
    /* Reprendre un territoire amène d'abord à lui : il peut avoir été peint
       à l'autre bout du monde, et une carte qui regarde ailleurs ne montre
       alors rien du dessin qu'on vient de rouvrir. En tête des trois, parce
       qu'on ne reprend un territoire qu'en le demandant. */
    if (lookAt) return lookAt;
    // A zone being changed opens where it already is: asking somebody to pan
    // back to the circle they set last week is asking them to set it again.
    if (asking?.kind === "zone" && asking.from) {
      return [asking.from.longitude, asking.from.latitude];
    }
    return selectedEvent
      ? [selectedEvent.longitude, selectedEvent.latitude]
      : undefined;
  }, [lookAt, asking, selectedEvent]);

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

  useEffect(() => {
    onStudyingChange(studying);
  }, [studying, onStudyingChange]);

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
          /* Le cadrage de l'étude passe devant : pendant qu'on interroge, ce
             n'est plus la frise ni la tuile qui décident où l'on regarde —
             c'est la question. Il porte aussi l'échelle, que rien d'autre ne
             règle : hors étude, le lecteur garde la sienne. */
          center={framing ? framing.center : center}
          zoom={framing ? framing.zoom : undefined}
          centerAnimationDuration={hasFramed.current ? 650 : 0}
          /* Rien à ajouter tant que la barre d'onglets est là : elle est
             ancrée sous cette planche et porte déjà la zone sûre de
             l'appareil. Elle s'efface pour laisser le viseur travailler, et
             la planche descend alors jusqu'au bord — la ligne de crédits
             reprend donc à son compte ce que la barre portait. */
          attributionOffset={aiming || drawing || studying ? insets.bottom : 0}
          onDetailChange={setDetailed}
          onStyleFailed={setStyleFailed}
          /* Une touche dans le vide replie la tuile, sans quitter ce qu'on
             lit : le marqueur reste le marqueur courant et la frise reste à
             son arrêt — seule la tuile se range.
             « Dans le vide » est tenu par le natif et non par nous : un appui
             qui tombe sur un territoire ou sur une ville part à son calque et
             s'arrête là, sans jamais arriver ici — la fiche du territoire
             s'ouvre donc sans que la tuile s'efface sous elle.
             Rien pendant qu'on vise ou qu'on peint, comme pour les deux
             calques au-dessous : il n'y a alors pas de tuile à refermer, et
             chaque touche appartient au geste en cours. */
          onPress={aiming || drawing || studying ? undefined : () => dismissTile()}
          onLook={(centre, zoom) => {
            looking.current = centre;
            setZoom(zoom);
            /* Demandée à `brush.ts` plutôt que recopiée ici : les deux
               copies portaient la même constante fausse, et le cercle du
               viseur de région était donc dessiné à la moitié du rayon
               qu'il annonçait. */
            const perPoint = metresPerPoint(zoom, centre.latitude);
            setPointsPerMetre(perPoint === 0 ? null : 1 / perPoint);
          }}
          // One finger paints, so it must not also drag the plate. Pinch is
          // untouched: the reader can still zoom to where they are working.
          frozen={drawing && tool !== "hand"}
        >
          {/* Settlements first, territories after: MapLibre places symbols
              from the topmost layer down, so the country name wins the room
              against the town names crowding around its anchor. */}
          {MAP_FEATURES.places ? (
            <PlaceLayers
              zoom={zoom}
              // Pas pendant qu'on vise ou qu'on peint : chaque touche
              // appartient à cela, et le viseur est ce avec quoi on vise.
              onTouch={
                aiming || drawing || studying ? undefined : setTouchedPlace
              }
            />
          ) : null}
          {MAP_FEATURES.territories && filters.territories ? (
            <TerritoryLayers
              detailed={detailed}
              // Not while an event is being placed: every touch belongs to
              // that, and the reticle is what the reader is aiming with.
              onTouch={aiming || drawing || studying ? undefined : setTouched}
            />
          ) : null}
          {drawing ? (
            <BrushLayers
              strokes={shown}
              trail={trail}
              erasing={tool === "eraser"}
              width={BRUSH_POINTS}
            />
          ) : null}
          {/* Somebody else's territory, offered for a look. Above the washes
              of the map itself, since it is a proposal and not yet part of
              the world. */}
          {asking?.kind === "shape" ? (
            <ShapeOnShow shape={asking.shape} />
          ) : null}
          {/* La forme demandée, qui respire. Elle passe avant les marqueurs
              pour la raison ordinaire des calques : un lavis ne doit pas se
              poser par-dessus ce qu'on peut toucher. */}
          {studying && study.shape !== null ? (
            <StudyShape shape={study.shape} />
          ) : null}
          {/* Rien de la collection pendant qu'on peint : les marqueurs se
              confondraient avec la peinture, et ce n'est pas d'eux qu'il
              s'agit à ce moment-là.
              Rien non plus pendant une étude, et pour une raison plus dure :
              les autres marqueurs porteraient la réponse. Seul celui de la
              question reste, et ce n'est pas le même objet — voir
              `StudyMarker`. */}
          {drawing || studying ? null : <EventMarkers />}
          {/* People last, so a cameo is never buried under a locket: the one
              the finger can see is the one the finger should get. */}
          {drawing || studying ? null : <CharacterMarkers />}
          {studying && study.subject !== null ? (
            <StudyMarker subject={study.subject} />
          ) : null}
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
          {/* La gomme prend la même nappe que le pinceau : c'est le même
              geste, et c'est `lay` qui décide ensuite ce qu'il en fait. */}
          {tool === "hand" ? null : (
            <BrushOverlay mapRef={mapRef} onStroke={lay} onTrail={setTrail} />
          )}
          <DrawPolityBar
            strokes={strokes.length}
            busy={saving}
            tool={tool}
            onToolChange={setTool}
            bottom={insets.bottom + space.md}
            onCancel={stopDrawing}
            onFinish={() => setNaming(true)}
          />
        </>
      ) : null}

      <NamePolityDialog
        /* Remontée à chaque ouverture, pour que ses champs soient ceux du
           territoire qu'on reprend — ou vierges pour un territoire neuf.
           Elle tient son brouillon, et celui d'avant y serait resté. */
        key={`polity-${editing?.id ?? "new"}`}
        visible={naming}
        busy={saving}
        known={
          editing
            ? { name: editing.name, from: editing.from, to: editing.to }
            : null
        }
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

      {aiming || drawing || studying ? null : (
        <>
          <View
            style={[styles.top, { top: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            {/* Le mortier à gauche, le crayon à droite, et entre eux ce qu'on
                regarde : les deux verbes de la planche se font face. */}
            <View style={styles.topLeft}>
              <StudyButton onStart={study.begin} />
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
                  onEditShape={(territory) => void editShape(territory)}
                  onPose={() => void poseAPlace()}
                />
              ) : null}
            </View>
          </View>

          {/* Full width, outside the padded column: the strokes have to reach
              the edges of the screen to fade out against them. */}
          <View style={[styles.frieze, { bottom: CREDITS_STRIP }]}>
            <Timeline />
          </View>

          <View
            style={[
              styles.bottom,
              { bottom: CREDITS_STRIP + FRIEZE_HEIGHT + space.sm },
            ]}
            pointerEvents="box-none"
          >
            {/* Deux pannes et deux phrases : le fond de carte qui manque,
                et la collection qui n'a pas chargé. Elles se lisent l'une
                au-dessus de l'autre quand elles arrivent ensemble — c'est
                le cas hors ligne — parce qu'elles ne se réparent pas de la
                même façon.

                Le fond n'a pas de bouton : MapLibre réessaie de lui-même et
                `onStyleFailed` efface la phrase dès qu'il y parvient. Un
                « Réessayer » qui ne ferait que doubler ce que le système
                fait déjà promettrait une prise que le lecteur n'a pas. */}
            {styleFailed ? (
              <Paper style={styles.errorCard}>
                <Text style={styles.error}>
                  Le fond de carte n'a pas pu se charger.
                </Text>
              </Paper>
            ) : null}

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
            {tileDismissed ? null : selectedEvent ? (
              <EventSummaryCard
                floating
                event={selectedEvent}
                onOpen={() => onRaise({ kind: "event", id: selectedEvent.id })}
              />
            ) : selectedPerson ? (
              <CharacterSummaryCard
                floating
                person={selectedPerson}
                onOpen={() => onRaise({ kind: "person", id: selectedPerson.id })}
              />
            ) : null}
          </View>
        </>
      )}

      {/* Le plateau de l'étude : le compte en haut, la question en bas, et
          les deux cartes qui la closent. Toujours monté — c'est lui qui porte
          le relevé, qu'on voit après que l'étude a cessé. */}
      <StudyBoard study={study} />

      {/* Les deux fiches que la planche elle-même ouvre : ce que le doigt a
          trouvé dessus. Elles appartiennent à la carte et non à la coquille,
          puisque rien d'autre qu'une touche sur la planche ne les lève. */}
      <TerritorySheet territory={touched} onClose={() => setTouched(null)} />

      <PlaceSheet place={touchedPlace} onClose={() => setTouchedPlace(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.surface },
  top: {
    position: "absolute",
    left: 10,
    right: 10,
    alignItems: "center",
  },
  topLeft: { position: "absolute", left: 0, top: 0, gap: space.sm },
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
