import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Dialog } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { FolderSelector } from "../events/components/FolderSelector";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

export type FilterModalProps = { visible: boolean; onClose: () => void };

/**
 * What the map is showing, and how to change it.
 *
 * A card in the middle rather than a sheet from the bottom, and the difference
 * is not decoration: the sheets are for *making* — six steps, a keyboard, a
 * thumb at the foot of the screen. This one asks a single question about what
 * is already there, answers it in one line, and the cross in the corner is the
 * whole way out. Nothing here is filled in, so nothing needs to rise.
 */
export function FilterModal({ visible, onClose }: FilterModalProps) {
  const { events, folders, filters, setFilters, visibleEvents } = useEvents();
  const count = visibleEvents.length;

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Filtres"
      /* The cross is the whole way out. Every change here lands on the map
         the moment it is made, so there is nothing to confirm and nothing to
         back out of — a row of buttons would only be furniture. */
      dismissLabel={null}
    >
      {/* Bounded and scrolling: the card is sized by what it holds, and a
          reader with a dozen classeurs open would otherwise grow it past the
          top and bottom of the screen. */}
      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        {/* The same control as the form's fourth step, down to the card: a
            folder and the importance it carries are one thing to look at here
            too, and "Toutes" is the fourth answer only filtering has. */}
        <FolderSelector
          folders={folders}
          value={filters.folders}
          onChange={(next) => setFilters({ folders: next })}
          allowAll
          emptyLabel="Filtrer par classeur"
        />

        {/* The answer to the question the card asks, pasted in like a ticket
            stub: its own little card, leaning. */}
        <View style={styles.tally}>
          <View style={styles.tallyRow}>
            <Text style={styles.tallyNumber}>{count}</Text>
            <Text style={styles.tallyLabel}>
              événement{count > 1 ? "s" : ""} affiché{count > 1 ? "s" : ""}
            </Text>
          </View>
          <Text style={styles.tallyOf}>
            {filters.folders.length === 0
              ? "toute la collection"
              : `sur ${events.length}`}
          </Text>
        </View>
      </ScrollView>

    </Dialog>
  );
}

const styles = StyleSheet.create({
  /** Tall enough for two or three classeurs, short enough to stay a card. */
  body: { maxHeight: 380 },
  content: { gap: space.xl, paddingBottom: space.xs },
  tally: {
    alignSelf: "center",
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.xxl,
    borderRadius: radius.lg,
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    transform: [{ rotate: "-1deg" }],
    ...shadow.soft,
  },
  tallyRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: space.sm,
  },
  tallyNumber: { ...type.plate, fontSize: 34, color: palette.wax },
  tallyLabel: { ...type.body, color: palette.inkSoft },
  tallyOf: { ...type.legend, color: palette.inkFaint, textAlign: "center" },
});
