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
     * Blanche et cernée, comme la pastille « Filtres » des pages.
     *
     * Elle fut en cire, puis en gris creusé et sans bord. Ce dernier état
     * tenait un raisonnement qui s'est retourné : la pastille devait
     * s'accorder au disque « Dessiner » posé près d'elle, qui avait perdu son
     * liseré, et *« une pastille cernée près d'un disque nu se lit comme un
     * oubli »*.
     *
     * L'argument valait tant qu'on regardait la planche seule. Mais ce bouton
     * a un jumeau ailleurs — celui qui ouvre les filtres dans Événements,
     * Personnages et Arbres — et c'est **le même geste pour la même chose**.
     * Qu'il change d'aspect selon l'écran en faisait deux objets. Un lecteur
     * qui a appris la pastille blanche cernée dans une liste doit la
     * reconnaître sur la carte.
     *
     * Entre s'accorder à son voisin et s'accorder à son jumeau, c'est le
     * jumeau qui l'emporte : le voisin fait un autre métier.
     */
    backgroundColor: palette.surfaceRaised,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.border,
    /**
     * L'ombre reste, elle, et c'est ce qui sépare les deux jumeaux.
     *
     * Celui des pages n'en porte aucune : il est posé sur du papier, entre un
     * titre et une liste, et un papier n'a pas besoin qu'on l'en détache.
     * Celui-ci flotte au-dessus d'une carte qui a ses propres couleurs — un
     * lavis de territoire peut passer dessous à tout moment —, et le filet
     * seul n'y suffirait pas.
     *
     * C'est celle du disque « Dessiner », partagée telle quelle : 0,38
     * d'opacité, rayon 13, jetée sept points plus bas, contre les 0,26 que
     * `GlyphButton` pose d'ordinaire. Les deux objets de la planche se
     * tiennent donc toujours de la même main, par en dessous.
     */
    shadowColor: "#2A1F12",
    shadowOpacity: 0.38,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 12,
  },
  pressed: { opacity: 0.7 },

  /** En encre, comme les mots à côté — une seule encre sur le blanc. */
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
    /** 21:1 sur le blanc : c'est un relevé, il se lit d'abord. */
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
