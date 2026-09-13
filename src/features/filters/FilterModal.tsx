import { ScrollView, StyleSheet, Text, View } from "react-native";

import { InkButton, Sheet } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { FolderSelector } from "../events/components/FolderSelector";
import { NO_FILTERS } from "../events/types";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

export type FilterModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function FilterModal({ visible, onClose }: FilterModalProps) {
  const { folders, filters, setFilters, visibleEvents } = useEvents();
  const count = visibleEvents.length;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filtres"
      footer={
        <>
          <InkButton
            label="Tout afficher"
            variant="tonal"
            grow
            disabled={filters.folders.length === 0}
            onPress={() => setFilters(NO_FILTERS)}
          />
          <InkButton label="Terminé" variant="solid" grow onPress={onClose} />
        </>
      }
    >
      <ScrollView contentContainerStyle={styles.body}>
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

        <View style={styles.tally}>
          <Text style={styles.tallyNumber}>{count}</Text>
          <Text style={styles.tallyLabel}>
            événement{count > 1 ? "s" : ""} affiché{count > 1 ? "s" : ""}
          </Text>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  tally: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: space.sm,
    paddingTop: space.sm,
  },
  tallyNumber: { fontSize: 28, fontWeight: "700", color: palette.wax },
  tallyLabel: { ...type.body, color: palette.inkSoft },
});
