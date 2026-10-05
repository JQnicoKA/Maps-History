import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Dialog, SegmentedControl, TICK, TickRow } from "../../components/ui";
import { VIEWS, type ScreenView } from "./view";
import { useEvents } from "../events/EventsProvider";
import { FolderSelector } from "../events/components/FolderSelector";
import { formatYear } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

export type FilterModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Ce que l'écran montre : la carte, ou la liste des événements. */
  view: ScreenView;
  onViewChange: (view: ScreenView) => void;
};

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
      <TickRow title={title} detail={detail} on={on} onToggle={onToggle} />

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
export function FilterModal({
  visible,
  onClose,
  view,
  onViewChange,
}: FilterModalProps) {
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
      /* A panel, not a question: titled like the sheets it sits beside. */
      centred
      /* Every change lands on the map at once: nothing to confirm, nothing to
         back out of, and a row of buttons would only be furniture. */
      dismissLabel={null}
    >
      {/* Bounded and scrolling: the events card grows with every classeur
          opened, and the whole thing would otherwise run off both ends of
          the screen. */}
      {/* Avant les calques, parce qu'elle les gouverne : sur une liste, un
          territoire n'a nulle part où s'afficher. Hors du défilement, pour
          rester en vue quand les classeurs allongent la carte des
          événements. */}
      <View style={styles.vue}>
        <SegmentedControl
          segments={VIEWS}
          value={view}
          onChange={onViewChange}
        />
      </View>

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

        {/* Le même calque gouverne les deux vues, mais il ne dit pas la même
            chose : la carte ne montre que les vivants de l'année lue et que
            ceux qui ont un point, la liste les recense tous. Compter les uns
            en parlant de l'autre serait un chiffre faux. */}
        <Layer
          title="Personnages"
          detail={
            !filters.characters
              ? "masqués"
              : view === "list"
                ? `${characters.length} dans la liste`
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
            {view === "list"
              ? "Mêlés aux événements, à la date de leur naissance."
              : "Chacun se tient à l'endroit où vous l'avez placé, de sa naissance à sa mort."}
          </Text>
        </Layer>

        {/* Rien à cocher en vue liste : les frontières se dessinent sur la
            carte et nulle part ailleurs. Le réglage lui-même n'est pas
            touché — il retrouve sa valeur en revenant à la carte. */}
        {view === "map" ? (
          <Layer
            title="Territoires"
            detail={
              filters.territories ? "les frontières de l'année lue" : "masqués"
            }
            on={filters.territories}
            onToggle={() => setFilters({ territories: !filters.territories })}
          />
        ) : null}
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  /** Détaché des calques : il change de quoi on parle, eux de ce qu'on voit. */
  vue: { paddingBottom: space.md },

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

  /** Indented under the tick, so what it governs is unmistakable. */
  inside: { paddingLeft: TICK + space.md, gap: space.sm },
  note: { ...type.legend, color: palette.inkFaint },
});
