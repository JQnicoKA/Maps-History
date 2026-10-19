import {
  Camera,
  Map,
  type LngLat,
  type MapProps,
  type MapRef,
} from "@maplibre/maplibre-react-native";
import { type ReactNode, type Ref, useCallback, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { MapAttribution } from "./MapAttribution";
import { ParchmentOverlay } from "./ParchmentOverlay";
import { env } from "../../config/env";
import { INITIAL_VIEW, MAP_FEATURES, ZOOM } from "../../config/map";
import { createOldAtlasStyle } from "../../map/style";

export type WorldMapProps = {
  /**
   * MapLibre children — sources, layers, markers, annotations. The map owns
   * nothing but the base plate, so every overlay comes in through here.
   */
  children?: ReactNode;
  mapRef?: Ref<MapRef>;
  /** Recentres the plate without touching the zoom level. */
  center?: LngLat;
  onPress?: MapProps["onPress"];
  /** 0 recentres instantly — used for the very first framing. */
  centerAnimationDuration?: number;
  /** Lifts the credit line clear of whatever chrome sits at the bottom. */
  attributionOffset?: number;
  /**
   * La planche n'a pas pu charger son style, ou l'a retrouvé.
   *
   * **C'est le seul échec de carte que MapLibre nous dise.** Une tuile qui
   * revient en 502 est journalisée côté natif et réessayée sans qu'aucun
   * événement ne remonte ici — et c'est raisonnable : elles se comptent par
   * centaines et la plupart des échecs sont passagers. Ce qui remonte, c'est
   * la panne entière : le style lui-même introuvable, auquel cas il n'y a
   * pas de carte du tout.
   */
  onStyleFailed?: (failed: boolean) => void;
  /**
   * Fires when the plate crosses into — or back out of — country zoom, and
   * only then. Overlays that carry a lot of geometry use it to hold their
   * detail back until it can actually be read.
   */
  onDetailChange?: (detailed: boolean) => void;
  /**
   * Where the plate came to rest, after every settled gesture.
   *
   * For the panels that ask the collection "what is there, near here": they
   * have no other way to know what the reader is looking at.
   */
  onLook?: (
    centre: { longitude: number; latitude: number },
    zoom: number,
  ) => void;
  /**
   * Frees the single finger for something other than panning.
   *
   * While drawing, one finger paints and must not drag the plate. Pinch is
   * left alone, so the reader can still zoom to where they are working — and
   * `dragPan` is the only thing given up, which two fingers do not need.
   */
  frozen?: boolean;
};

export function WorldMap({
  children,
  mapRef,
  center,
  onPress,
  centerAnimationDuration = 650,
  attributionOffset,
  onStyleFailed,
  onDetailChange,
  onLook,
  frozen = false,
}: WorldMapProps) {
  const mapStyle = useMemo(
    () => createOldAtlasStyle({ apiKey: env.maptilerApiKey }),
    [],
  );

  // The viewport reports on every settled gesture; only the crossing matters,
  // so the boolean is compared before being passed on and nothing re-renders
  // while the reader pans around at one scale.
  const detailed = useRef(false);
  const handleRegionDidChange = useCallback<
    NonNullable<MapProps["onRegionDidChange"]>
  >(
    (event) => {
      const [longitude, latitude] = event.nativeEvent.center as [
        number,
        number,
      ];
      onLook?.({ longitude, latitude }, event.nativeEvent.zoom);

      const next = event.nativeEvent.zoom >= ZOOM.country;
      if (next === detailed.current) return;
      detailed.current = next;
      onDetailChange?.(next);
    },
    [onDetailChange, onLook],
  );

  return (
    <View style={styles.container}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={mapStyle}
        onPress={onPress}
        onRegionDidChange={
          onDetailChange || onLook ? handleRegionDidChange : undefined
        }
        onDidFailLoadingMap={
          onStyleFailed ? () => onStyleFailed(true) : undefined
        }
        /* Et le retour : MapLibre réessaie de lui-même, donc il faut écouter
           la réussite autant que l'échec, sinon le message resterait affiché
           sur une carte redevenue parfaitement lisible. */
        onDidFinishLoadingMap={
          onStyleFailed ? () => onStyleFailed(false) : undefined
        }
        // An atlas plate is read flat and square to the page: pan and zoom only.
        touchRotate={false}
        touchPitch={false}
        dragPan={!frozen}
        logo={false}
        compass={false}
        scaleBar={false}
        attribution={false}
        preferredFramesPerSecond={60}
      >
        <Camera
          initialViewState={INITIAL_VIEW}
          minZoom={ZOOM.min}
          maxZoom={ZOOM.max}
          {...(center
            ? {
                center,
                animationDuration: centerAnimationDuration,
                easing: "ease" as const,
              }
            : {})}
        />
        {children}
      </Map>
      {MAP_FEATURES.paperTexture ? <ParchmentOverlay /> : null}
      <MapAttribution offset={attributionOffset} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
