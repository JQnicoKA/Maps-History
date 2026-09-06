import { Camera, Map } from "@maplibre/maplibre-react-native";
import { type ReactNode, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { MapAttribution } from "./MapAttribution";
import { ParchmentOverlay } from "./ParchmentOverlay";
import { env } from "../../config/env";
import { INITIAL_VIEW, MAP_FEATURES, ZOOM } from "../../config/map";
import { createOldAtlasStyle } from "../../map/style";

export type WorldMapProps = {
  /**
   * MapLibre children — sources, layers, markers, annotations. The map owns
   * nothing but the base plate, so every future overlay comes in through here.
   */
  children?: ReactNode;
};

export function WorldMap({ children }: WorldMapProps) {
  const mapStyle = useMemo(
    () => createOldAtlasStyle({ apiKey: env.maptilerApiKey }),
    [],
  );

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={mapStyle}
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
        />
        {children}
      </Map>
      {MAP_FEATURES.paperTexture ? <ParchmentOverlay /> : null}
      <MapAttribution />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
