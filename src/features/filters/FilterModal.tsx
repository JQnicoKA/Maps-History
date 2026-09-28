import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Dialog } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { FolderSelector } from "../events/components/FolderSelector";
import { formatYear } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

export type FilterModalProps = { visible: boolean; onClose: () => void };

type LayerProps = {
  title: string;
  /** What is on show right now, in as few words as it takes. */
  detail: string;
  on: boolean;
  onToggle: () => void;
  /** Whatever narrows this layer further, shown only while it is on. */
  children?: ReactNode;
};

/**
 * One of the three things the plate carries, and whether it is carried.
 *
 * A card each rather than three lines in a list: the events bring a whole
 * control of their own with them, and a checkbox whose settings live at the
 * same indentation as the next checkbox is a checkbox nobody can tell the
 * scope of. Inside the card, the folders plainly belong to the events.
 */
function Layer({ title, detail, on, onToggle, children }: LayerProps) {
  return (
    <View style={[styles.layer, on ? null : styles.layerOff]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={title}
        onPress={onToggle}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <View style={[styles.box, on && styles.boxOn]}>
          {on ? <Text style={styles.tick}>✓</Text> : null}
        </View>
        <View style={styles.headText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
      </Pressable>

      {on && children ? <View style={styles.inside}>{children}</View> : null}
    </View>
  );
}

/**
 * What the map is showing, and how to change it.
 *
 * Three things are drawn on the plate and each can be put away: what happened,
 * who was there, and the world underneath. They were never on one panel before
 * because only the events could be filtered — the territories were hidden one
 * by one from the pencil, and the people were not on the map at all.
 *
 * A card in the middle rather than a sheet from the bottom: the sheets are for
 * *making*, and nothing here is filled in. Every answer lands on the map the
 * moment it is given, so there is nothing to confirm and the cross is the
 * whole way out.
 */
export function FilterModal({ visible, onClose }: FilterModalProps) {
  const {
    events,
    folders,
    characters,
    visibleCharacters,
    filters,
    setFilters,
    visibleEvents,
    year,
  } = useEvents();

  const shown = visibleEvents.length;
  const placed = characters.filter(
    (person) => person.longitude !== null && person.birth !== null,
  ).length;

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Filtres"
      /* Every change lands on the map at once: nothing to confirm, nothing to
         back out of, and a row of buttons would only be furniture. */
      dismissLabel={null}
    >
      {/* Bounded and scrolling: the events card grows with every classeur
          opened, and the whole thing would otherwise run off both ends of
          the screen. */}
      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <Layer
          title="Événements"
          detail={
            filters.events
              ? filters.folders.length === 0
                ? `toute la collection · ${events.length}`
                : `${shown} sur ${events.length}`
              : "masqués"
          }
          on={filters.events}
          onToggle={() => setFilters({ events: !filters.events })}
        >
          {/* The same control as the form's fourth step, down to the card: a
              folder and the importance it carries are one thing to look at
              here too, and "Toutes" is the fourth answer only filtering has. */}
          <FolderSelector
            folders={folders}
            value={filters.folders}
            onChange={(next) => setFilters({ folders: next })}
            allowAll
            emptyLabel="Filtrer par classeur"
          />
        </Layer>

        <Layer
          title="Personnages"
          detail={
            !filters.characters
              ? "masqués"
              : placed === 0
                ? "aucun n'est placé sur la carte"
                : `${visibleCharacters.length} présent${visibleCharacters.length > 1 ? "s" : ""}${
                    year === null ? "" : ` en ${formatYear(Math.trunc(year))}`
                  }`
          }
          on={filters.characters}
          onToggle={() => setFilters({ characters: !filters.characters })}
        >
          <Text style={styles.note}>
            Chacun se tient à l'endroit où vous l'avez placé, de sa naissance à
            sa mort.
          </Text>
        </Layer>

        <Layer
          title="Territoires"
          detail={filters.territories ? "les frontières de l'année lue" : "masqués"}
          on={filters.territories}
          onToggle={() => setFilters({ territories: !filters.territories })}
        />
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  /** Tall enough for the three cards, short enough to stay a card itself. */
  body: { maxHeight: 420 },
  content: { gap: space.md, paddingBottom: space.xs },

  layer: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    ...shadow.soft,
  },
  /** Put away, and it says so without going grey enough to look broken. */
  layerOff: { opacity: 0.6, backgroundColor: palette.sunken },

  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  pressed: { opacity: 0.6 },
  /** Drawn square and thick-edged: a box someone ticks, not a switch. */
  box: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: palette.paperDeep,
    backgroundColor: palette.paperLight,
  },
  boxOn: { backgroundColor: palette.wax, borderColor: palette.waxDeep },
  tick: { fontSize: 14, lineHeight: 16, fontWeight: "900", color: palette.paperLight },

  headText: { flex: 1, gap: 1 },
  title: { fontSize: 16, fontWeight: "700", color: palette.ink },
  detail: { ...type.legend, color: palette.inkSoft },

  /** Indented under the tick, so what it governs is unmistakable. */
  inside: { paddingLeft: 24 + space.md, gap: space.sm },
  note: { ...type.legend, color: palette.inkFaint },
});
