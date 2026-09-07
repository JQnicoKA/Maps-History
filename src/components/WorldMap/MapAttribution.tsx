import { StyleSheet, Text, View } from "react-native";

import { ATTRIBUTION } from "../../config/map";
import { palette } from "../../theme/palette";

/**
 * MapTiler and OpenStreetMap both require visible credit, so this replaces the
 * native attribution ornament with something that belongs on the plate.
 */
export function MapAttribution({ offset = 0 }: { offset?: number }) {
  return (
    <View pointerEvents="none" style={[styles.container, { bottom: offset + 8 }]}>
      <Text style={styles.text}>{ATTRIBUTION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", right: 10 },
  text: {
    fontSize: 9,
    letterSpacing: 0.3,
    color: palette.inkSoft,
    opacity: 0.75,
  },
});
