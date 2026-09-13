import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { EVENT_TYPES, describeType, type EventType } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space } from "../../../theme/tokens";

export type TypePickerProps = {
  value: EventType;
  onChange: (value: EventType) => void;
};

/**
 * The sixteen types as a row of emoji, scrolled sideways.
 *
 * This was a field that opened a sheet — two taps and a modal to say "bataille".
 * Sixteen is few enough to put on a rail: one tap, and the choice is visible at
 * rest instead of hidden behind a summary line. The name of the chosen type is
 * written beside the heading, so the emoji never has to carry the meaning alone.
 */
export function TypePicker({ value, onChange }: TypePickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      keyboardShouldPersistTaps="handled"
    >
      {EVENT_TYPES.map((entry) => {
        const selected = entry.value === value;
        return (
          <Pressable
            key={entry.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={entry.label}
            onPress={() => onChange(entry.value)}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.selected,
              pressed && !selected && styles.pressed,
            ]}
          >
            <Text style={styles.emoji}>{entry.emoji}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** The chosen type's name, for the caller to set beside its heading. */
export function typeName(value: EventType): string {
  return describeType(value).label;
}

const CHIP = 46;

const styles = StyleSheet.create({
  // The form already pads the column; the rail only needs its own gaps.
  rail: { gap: space.sm, paddingVertical: 2 },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.sunken,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selected: {
    backgroundColor: palette.paperLight,
    borderColor: palette.wax,
  },
  pressed: { opacity: 0.6 },
  emoji: { fontSize: 22 },
});
