import {
  Camera,
  Map,
  type LngLat,
  type MapProps,
  type MapRef,
} from "@maplibre/maplibre-react-native";
import { type ReactNode, type Ref, useMemo } from "react";
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
  /** Lifts the credit line clear of whatever chrome sits at the bottom. */
  attributionOffset?: number;
};

export function WorldMap({
  children,
  mapRef,
  center,
  onPress,
  attributionOffset,
}: WorldMapProps) {
  const mapStyle = useMemo(
    () => createOldAtlasStyle({ apiKey: env.maptilerApiKey }),
    [],
  );

  return (
    <View style={styles.container}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={mapStyle}
        onPress={onPress}
        // An atlas plate is read flat and square to the page: pan and zoom only.
        touchRotate={false}
        touchPitch={false}
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
          {...(center ? { center, animationDuration: 650, easing: "ease" as const } : {})}
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
