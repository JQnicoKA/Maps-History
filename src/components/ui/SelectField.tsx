import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { InkButton } from "./InkButton";
import { Sheet } from "./Sheet";
import { palette } from "../../theme/palette";
import { radius, space, TOUCH, type } from "../../theme/tokens";

export type SelectOption = { value: string; label: string };

export type SelectFieldProps = {
  label?: string;
  /** Heading of the sheet that opens. */
  title: string;
  placeholder: string;
  options: SelectOption[];
  selected: string[];
  onToggle: (value: string) => void;
  /** One choice only: picking a row closes the sheet. */
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

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <InkButton
            label="Fermer"
            variant="solid"
            grow
            onPress={() => setOpen(false)}
          />
        }
      >
        {options.length === 0 ? (
          <Text style={styles.empty}>{emptyMessage}</Text>
        ) : (
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
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
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Text
                    style={[styles.rowLabel, isSelected && styles.rowSelected]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                  {isSelected ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {footer ? <View style={styles.footerSlot}>{footer}</View> : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
  label: { ...type.legend, color: palette.inkSoft },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: TOUCH,
    paddingHorizontal: space.md,
    backgroundColor: palette.sunken,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.65 },
  value: { flex: 1, fontSize: 16, color: palette.ink },
  placeholder: { color: palette.inkFaint },
  chevron: { fontSize: 13, color: palette.inkSoft },
  list: { maxHeight: 340, paddingHorizontal: space.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  rowPressed: { opacity: 0.6 },
  rowLabel: { flex: 1, fontSize: 16, color: palette.inkSoft },
  rowSelected: { color: palette.ink, fontWeight: "600" },
  check: { fontSize: 16, color: palette.wax, fontWeight: "700" },
  empty: {
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    textAlign: "center",
    ...type.body,
    color: palette.inkFaint,
  },
  footerSlot: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
});
