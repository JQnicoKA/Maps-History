import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FilterModal } from "./FilterModal";
import type { ScreenView } from "./view";
import { useEvents } from "../events/EventsProvider";
import { palette } from "../../theme/palette";
import { radius, space, TOUCH } from "../../theme/tokens";

/**
 * The funnel, drawn rather than loaded.
 *
 * It was a PNG, tinted cream to match the words beside it, and the tint did
 * not take — the glyph stayed the dark brown it was exported in. Three bars
 * of decreasing width *are* a funnel, they cost nothing, and they are the
 * colour they are told to be at any size.
 */
function Funnel() {
  return (
    <View style={styles.funnel}>
      <View style={[styles.bar, styles.barWide]} />
      <View style={[styles.bar, styles.barMid]} />
      <View style={[styles.bar, styles.barNarrow]} />
    </View>
  );
}

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
export type FilterButtonProps = {
  view: ScreenView;
  onViewChange: (view: ScreenView) => void;
};

export function FilterButton({ view, onViewChange }: FilterButtonProps) {
  const { filters, folders } = useEvents();
  const [open, setOpen] = useState(false);

  const selected = filters.folders;
  /**
   * What the pill says, in the fewest words that are still true.
   *
   * Two things can narrow the map now — whole layers put away, and folders
   * chosen within the events — and they cannot both fit on a pill. The layers
   * win when any is off, because a missing layer is the bigger surprise: a
   * reader who cannot find their events needs to be told the events are off,
   * not which classeur is selected. The popup tells the whole story.
   */
  // Les calques que cette vue propose réellement. Sur une liste, les
  // territoires n'en sont pas un : les compter ferait dire « 2 calques » à
  // une carte qui montre tout ce qu'elle peut montrer.
  const layers = [
    { on: filters.events, name: "Événements" },
    { on: filters.characters, name: "Personnages" },
    ...(view === "map"
      ? [{ on: filters.territories, name: "Territoires" }]
      : []),
  ];
  const shown = layers
    .filter((layer) => layer.on)
    .map((layer) => layer.name);

  const filtering = shown.length < layers.length || selected.length > 0;
  const label =
    shown.length < layers.length
      ? shown.length === 0
        ? "Rien"
        : shown.length === 1
          ? shown[0]!
          : `${shown.length} calques`
      : selected.length === 0
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
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Funnel />
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {filtering ? <View style={styles.dot} /> : null}
      </Pressable>

      <FilterModal
        visible={open}
        onClose={() => setOpen(false)}
        view={view}
        onViewChange={onViewChange}
      />
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
    // Wax, always. It is the one control on the plate that is not a door:
    // the discs open panels and say nothing, this one carries the answer to
    // "what am I looking at". Colouring it only while filtering made it a
    // different object depending on the answer.
    backgroundColor: palette.wax,
    borderRadius: radius.pill,
    // The same cut edge and the same lift as the discs — see `GlyphButton`.
    borderWidth: 1.5,
    borderColor: palette.waxDeep,
    shadowColor: "#2A1F12",
    shadowOpacity: 0.26,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressed: { opacity: 0.7 },

  /** Cream, like the words beside it — one ink on the wax, not two. */
  funnel: { alignItems: "center", gap: 2.5, paddingVertical: 1 },
  bar: {
    height: 2.5,
    borderRadius: radius.pill,
    backgroundColor: palette.paperLight,
  },
  barWide: { width: 15 },
  barMid: { width: 10 },
  barNarrow: { width: 5 },
  label: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: palette.paperLight,
  },
  /**
   * The one mark left saying something is filtered.
   *
   * The pill no longer changes colour for it, so this bead carries the whole
   * of that news — with the words, which say "Tout" when nothing is hidden.
   */
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: palette.paperLight,
  },
});
