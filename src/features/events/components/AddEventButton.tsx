import { StyleSheet, Text } from "react-native";

import { GlyphButton } from "../../../components/ui";
import { palette } from "../../../theme/palette";

export function AddEventButton({ onPress }: { onPress: () => void }) {
  return (
    <GlyphButton accessibilityLabel="Ajouter un événement" onPress={onPress}>
      <Text style={styles.glyph}>+</Text>
    </GlyphButton>
  );
}

const styles = StyleSheet.create({
  glyph: { fontSize: 26, lineHeight: 30, color: palette.ink },
});
