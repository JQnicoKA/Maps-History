import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { FilterModal } from "./FilterModal";
import { useEvents } from "../events/EventsProvider";
import { palette } from "../../theme/palette";
import { radius, shadow, space, TOUCH } from "../../theme/tokens";

/**
 * The only chrome at the top of the plate: one word saying what is on show.
 * Everything else lives behind it.
 */
export function FilterButton() {
  const { filters, folders } = useEvents();
  const [open, setOpen] = useState(false);

  const selected = filters.folders;
  const label =
    selected.length === 0
      ? "Tous"
      : selected.length === 1
        ? (folders.find((f) => f.id === selected[0]!.folderId)?.name ?? "Tous")
        : `${selected.length} classeurs`;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filtres"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>

      <FilterModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    maxWidth: 190,
    minHeight: TOUCH,
    justifyContent: "center",
    paddingHorizontal: space.xl,
    backgroundColor: palette.paperLight,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    ...shadow.soft,
  },
  pressed: { opacity: 0.65 },
  label: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: palette.ink,
    textAlign: "center",
  },
});
