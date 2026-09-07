import { StyleSheet, Text, View } from "react-native";

import { Chip } from "../../../components/ui";
import type { Importance } from "../types";
import { palette } from "../../../theme/palette";

const OPTIONS: { value: Importance; label: string }[] = [
  { value: "high", label: "Élevée" },
  { value: "medium", label: "Moyenne" },
  { value: "low", label: "Faible" },
];

export type ImportanceRowProps = {
  name: string;
  value: Importance | null;
  onChange: (value: Importance | null) => void;
  /** Adds a "Toutes" choice — the filters need it, the form does not. */
  allowAll?: boolean;
};

/** The importance an event carries inside one folder. */
export function ImportanceRow({
  name,
  value,
  onChange,
  allowAll = false,
}: ImportanceRowProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.chips}>
        {allowAll ? (
          <Chip
            label="Toutes"
            selected={value === null}
            onPress={() => onChange(null)}
          />
        ) : null}
        {OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.inkFaint,
  },
  name: { fontSize: 12, color: palette.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
});
