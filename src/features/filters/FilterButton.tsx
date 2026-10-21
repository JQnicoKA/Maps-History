import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FilterModal } from "./FilterModal";
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
export function FilterButton() {
  const { filters } = useEvents();
  const [open, setOpen] = useState(false);

  const selected = filters.folders;
  /**
   * What the pill says, in the fewest words that are still true.
   *
   * Trois choses peuvent resserrer la carte — des calques rangés, des classeurs
   * choisis, une importance demandée — et elles ne tiennent pas ensemble sur
   * une pastille. The layers win when any is off, because a missing layer is
   * the bigger surprise: a reader who cannot find their events needs to be told
   * the events are off, not which classeur is selected. The popup tells the
   * whole story.
   */
  // Les trois calques de la planche. Il y en eut un nombre variable, du
  // temps où ce bouton servait aussi une vue liste à qui les territoires ne
  // disaient rien.
  const layers = [
    { on: filters.events, name: "Événements" },
    { on: filters.characters, name: "Personnages" },
    { on: filters.territories, name: "Territoires" },
  ];
  const shown = layers
    .filter((layer) => layer.on)
    .map((layer) => layer.name);

  const filtering =
    shown.length < layers.length ||
    selected.length > 0 ||
    filters.importance !== null;
  const label =
    shown.length < layers.length
      ? shown.length === 0
        ? "Rien"
        : shown.length === 1
          ? shown[0]!
          : `${shown.length} calques`
      : selected.length === 0
        ? // Une importance seule n'a pas de nom à donner : ce qu'elle
          // resserre, c'est la collection entière.
          filters.importance === null
          ? "Tout"
          : "Par importance"
        : selected.length === 1
          ? selected[0]!
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
    /**
     * Le gris creusé de l'application, et non plus la cire.
     *
     * Il resta longtemps en cire au motif qu'il n'est pas une porte : les
     * disques ouvrent des panneaux et ne disent rien, lui porte la réponse à
     * « qu'est-ce que je regarde ». C'est toujours vrai, et ce n'est pas la
     * couleur qui le dit — c'est qu'il porte des mots quand les autres
     * portent un dessin. La cire, elle, veut dire « voici ce que vous
     * lisez », ce que cette pastille ne marque pas.
     *
     * Le liseré passe de la cire sombre à `line` plutôt qu'à `border` : sur
     * ce gris, `border` ne pèse que 1,06 et disparaîtrait, là où `line`
     * tient 1,30 — assez pour se lire comme le bord taillé d'une pastille
     * découpée dans la feuille.
     */
    backgroundColor: palette.sunken,
    borderRadius: radius.pill,
    // The same cut edge and the same lift as the discs — see `GlyphButton`.
    borderWidth: 1.5,
    borderColor: palette.line,
    /**
     * L'ombre fait tout le travail de séparation, et plus qu'avant.
     *
     * La pastille était sombre sur une planche claire : elle se détachait
     * d'elle-même. Claire, elle ne pèse plus que 1,06 contre la terre du
     * fond et 1,25 contre la mer — c'est-à-dire rien. Ce qui la pose sur la
     * carte est désormais son ombre seule, et c'est la raison pour laquelle
     * elle est gardée telle quelle plutôt qu'allégée avec la couleur.
     */
    shadowColor: "#2A1F12",
    shadowOpacity: 0.26,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressed: { opacity: 0.7 },

  /** En encre, comme les mots à côté — une seule encre sur le gris. */
  funnel: { alignItems: "center", gap: 2.5, paddingVertical: 1 },
  bar: {
    height: 2.5,
    borderRadius: radius.pill,
    backgroundColor: palette.ink,
  },
  barWide: { width: 15 },
  barMid: { width: 10 },
  barNarrow: { width: 5 },
  label: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
    /** 8,9:1 sur le gris creusé : c'est un relevé, il se lit d'abord. */
    color: palette.ink,
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
    backgroundColor: palette.ink,
  },
});
