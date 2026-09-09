import { StyleSheet, Text, View } from "react-native";

import { SegmentedControl } from "../../../components/ui";
import type { Importance } from "../types";
import { palette } from "../../../theme/palette";
import { space } from "../../../theme/tokens";

type Value = Importance | "all";

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
  const segments: { value: Value; label: string }[] = allowAll
    ? [{ value: "all", label: "Toutes" }, ...OPTIONS]
    : OPTIONS;

  return (
    <View style={styles.container}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <SegmentedControl
        segments={segments}
        value={value ?? "all"}
        onChange={(next) => onChange(next === "all" ? null : next)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
  name: { fontSize: 15, color: palette.ink, fontWeight: "600" },
});
