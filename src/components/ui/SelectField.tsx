import { useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { InkButton } from "./InkButton";
import { Paper } from "./Paper";
import { palette } from "../../theme/palette";

export type SelectOption = { value: string; label: string };

export type SelectFieldProps = {
  label?: string;
  /** Heading of the list that opens. */
  title: string;
  placeholder: string;
  options: SelectOption[];
  selected: string[];
  onToggle: (value: string) => void;
  /** One choice only: picking a row closes the list. */
  single?: boolean;
  /** Rendered under the list — where "create a new folder" lives. */
  footer?: ReactNode;
  emptyMessage?: string;
};

/**
 * A field that opens a scrolling list rather than spreading every option across
 * the screen: the number of folders grows without bound, the chrome does not.
 */
export function SelectField({
  label,
  title,
  placeholder,
  options,
  selected,
  onToggle,
  single = false,
  footer,
  emptyMessage = "Aucune entrée pour l'instant.",
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const chosen = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Text
          numberOfLines={1}
          style={[styles.value, chosen.length === 0 && styles.placeholder]}
        >
          {chosen.length > 0 ? chosen.join(" · ") : placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          {/* A sibling, not a wrapper: a Pressable around the sheet would win
              the touch responder and stop the list inside from scrolling. */}
          <Pressable
            accessibilityLabel="Fermer"
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View
            style={[
              styles.sheetWrapper,
              { marginTop: insets.top + 40, marginBottom: insets.bottom + 40 },
            ]}
          >
            <Paper>
              <View style={styles.sheet}>
                <Text style={styles.title}>{title}</Text>

                {options.length === 0 ? (
                  <Text style={styles.empty}>{emptyMessage}</Text>
                ) : (
                  <ScrollView
                    style={styles.list}
                    keyboardShouldPersistTaps="handled"
                  >
                    {options.map((option) => {
                      const isSelected = selected.includes(option.value);
                      return (
                        <Pressable
                          key={option.value}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                          onPress={() => {
                            onToggle(option.value);
                            if (single) setOpen(false);
                          }}
                          style={({ pressed }) => [
                            styles.row,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[styles.rowLabel, isSelected && styles.rowSelected]}
                          >
                            {option.label}
                          </Text>
                          <Text style={styles.check}>{isSelected ? "✓" : ""}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}

                {footer}

                <View style={styles.actions}>
                  <InkButton
                    label="Fermer"
                    variant="solid"
                    onPress={() => setOpen(false)}
                  />
                </View>
              </View>
            </Paper>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 5 },
  label: {
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: palette.inkSoft,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.inkFaint,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.6 },
  value: { flex: 1, fontSize: 15, color: palette.ink },
  placeholder: { color: palette.inkFaint },
  chevron: { fontSize: 12, color: palette.inkSoft },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(58, 44, 27, 0.45)",
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  sheetWrapper: { maxHeight: "100%" },
  sheet: { padding: 14, gap: 10 },
  title: {
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: palette.ink,
    textAlign: "center",
  },
  list: { maxHeight: 280 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.inkFaint,
  },
  rowLabel: { flex: 1, fontSize: 15, color: palette.inkSoft },
  rowSelected: { color: palette.ink },
  check: { fontSize: 14, color: palette.wax, width: 18, textAlign: "right" },
  empty: {
    paddingVertical: 18,
    textAlign: "center",
    fontSize: 12,
    color: palette.inkFaint,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end" },
});
