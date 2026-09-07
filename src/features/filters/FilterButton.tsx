import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { FilterModal } from "./FilterModal";
import { useEvents } from "../events/EventsProvider";
import { palette } from "../../theme/palette";

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
    paddingHorizontal: 20,
    paddingVertical: 9,
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
  label: {
    fontSize: 13,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: palette.ink,
    textAlign: "center",
  },
});
