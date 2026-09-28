import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { FilterModal } from "./FilterModal";
import { useEvents } from "../events/EventsProvider";
import { palette } from "../../theme/palette";
import { radius, space, TOUCH } from "../../theme/tokens";

const FUNNEL = require("../../../assets/icons/filter.png");

/**
 * What is on show, and the way to change it.
 *
 * Deliberately unlike the discs around it. Those are doors — each opens a
 * panel and says nothing about the map — while this one is a **readout**: it
 * carries the answer to "what am I looking at", and pressing it is only how
 * you change that answer. A round glyph could never say "3 classeurs".
 *
 * So: a wide pill, a funnel, the current state in words, and — when something
 * is actually filtered — a wax dot, because a map showing less than everything
 * should never look like a map showing everything.
 */
export function FilterButton() {
  const { filters, folders } = useEvents();
  const [open, setOpen] = useState(false);

  const selected = filters.folders;
  const filtering = selected.length > 0;
  const label = !filtering
    ? "Tout"
    : selected.length === 1
      ? (folders.find((f) => f.id === selected[0]!.folderId)?.name ?? "Tout")
      : `${selected.length} classeurs`;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          filtering ? `Filtres — ${label}` : "Filtres — tout est affiché"
        }
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.button,
          filtering && styles.filtering,
          pressed && styles.pressed,
        ]}
      >
        <Image
          source={FUNNEL}
          style={[styles.funnel, filtering && styles.funnelOn]}
          resizeMode="contain"
        />
        <Text
          style={[styles.label, filtering && styles.labelOn]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {filtering ? <View style={styles.dot} /> : null}
      </Pressable>

      <FilterModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    maxWidth: 200,
    minHeight: TOUCH,
    paddingLeft: space.lg,
    paddingRight: space.lg,
    backgroundColor: palette.paperLight,
    borderRadius: radius.pill,
    // The same cut edge and the same lift as the discs — see `GlyphButton`.
    borderWidth: 1.5,
    borderColor: palette.paperDeep,
    shadowColor: "#2A1F12",
    shadowOpacity: 0.26,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  /**
   * Filtering is a state the reader must be able to see without reading.
   *
   * The pill itself takes the wax, faintly — enough to separate it from the
   * plain discs, not so much that it competes with the map behind it.
   */
  filtering: {
    backgroundColor: palette.wax,
    // Its own deeper tone, so the edge stays an edge once the pill is wax.
    borderColor: palette.waxDeep,
  },
  pressed: { opacity: 0.7 },

  funnel: { width: 16, height: 16, opacity: 0.7 },
  funnelOn: { tintColor: palette.paperLight, opacity: 0.85 },
  label: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: palette.ink,
  },
  labelOn: { color: palette.paperLight },
  /** A bead of wax on cream, cream on wax: visible either way round. */
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: palette.paperLight,
  },
});
