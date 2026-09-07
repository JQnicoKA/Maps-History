import { Pressable, StyleSheet, Text } from "react-native";

import { palette } from "../../../theme/palette";

export function AddEventButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajouter un événement"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.glyph}>+</Text>
    </Pressable>
  );
}

const SIZE = 44;

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperLight,
    borderWidth: 1,
    borderColor: palette.ink,
    borderRadius: 2,
    shadowColor: palette.ink,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pressed: { opacity: 0.6 },
  glyph: {
    fontSize: 26,
    lineHeight: 30,
    color: palette.ink,
  },
});
