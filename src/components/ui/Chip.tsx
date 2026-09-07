import { Pressable, StyleSheet, Text } from "react-native";

import { palette } from "../../theme/palette";

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

export function Chip({ label, selected = false, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: palette.inkFaint,
    borderRadius: 2,
  },
  selected: { backgroundColor: palette.ink, borderColor: palette.ink },
  pressed: { opacity: 0.6 },
  label: {
    fontSize: 11,
    letterSpacing: 0.9,
    color: palette.inkSoft,
  },
  selectedLabel: { color: palette.paperLight },
});
