import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Importance } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space } from "../../../theme/tokens";

const LEVELS: { value: Importance; label: string; height: number }[] = [
  { value: "low", label: "Faible", height: 9 },
  { value: "medium", label: "Moyenne", height: 15 },
  { value: "high", label: "Élevée", height: 21 },
];

export type ImportanceScaleProps = {
  value: Importance;
  onChange: (value: Importance) => void;
};

/**
 * Importance as three rising bars, filled up to the chosen one.
 *
 * A segmented control gives its options equal weight, which is exactly wrong
 * here: importance is a *magnitude*, and low, medium and high are not three
 * unrelated answers but one scale. The bars say so without a word, and take a
 * third of the width — which matters, since there is one of these per folder
 * an event is filed under.
 *
 * The filter sheet keeps the segmented control: there, "Toutes" is a real
 * fourth answer and no bar can stand for it.
 */
export function ImportanceScale({ value, onChange }: ImportanceScaleProps) {
  const reached = LEVELS.findIndex((level) => level.value === value);

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {LEVELS.map((level, index) => (
          <Pressable
            key={level.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: index === reached }}
            accessibilityLabel={`Importance ${level.label.toLowerCase()}`}
            hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
            onPress={() => onChange(level.value)}
            style={styles.target}
          >
            <View
              style={[
                styles.bar,
                { height: level.height },
                index <= reached && styles.filled,
              ]}
            />
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>{LEVELS[reached]?.label ?? ""}</Text>
    </View>
  );
}

const BAR = 6;

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  target: { justifyContent: "flex-end", paddingHorizontal: 1 },
  bar: {
    width: BAR,
    borderRadius: radius.sm / 2,
    backgroundColor: palette.line,
  },
  filled: { backgroundColor: palette.wax },
  label: {
    fontSize: 13,
    lineHeight: 15,
    color: palette.inkSoft,
    fontWeight: "600",
  },
});
