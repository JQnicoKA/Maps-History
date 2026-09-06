import { Image, StyleSheet, View } from "react-native";

const grain = require("../../../assets/textures/paper-grain.png");
const vignette = require("../../../assets/textures/vignette.png");

/**
 * Paper fibre and aged edges, drawn over the map rather than baked into the
 * tiles so the geography underneath stays crisp at every zoom level.
 */
export function ParchmentOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={grain} style={styles.grain} resizeMode="repeat" />
      <Image source={vignette} style={styles.vignette} resizeMode="stretch" />
    </View>
  );
}

const fill = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
} as const;

const styles = StyleSheet.create({
  grain: { ...fill, opacity: 0.35 },
  vignette: { ...fill, opacity: 0.7 },
});
