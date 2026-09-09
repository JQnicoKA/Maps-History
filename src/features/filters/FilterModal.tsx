import { ScrollView, StyleSheet, Text, View } from "react-native";

import { InkButton, SelectField, Sheet } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { ImportanceRow } from "../events/components/ImportanceRow";
import { NO_FILTERS, type Importance } from "../events/types";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

export type FilterModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function FilterModal({ visible, onClose }: FilterModalProps) {
  const { folders, filters, setFilters, visibleEvents } = useEvents();

  const toggleFolder = (folderId: string) => {
    const already = filters.folders.some((f) => f.folderId === folderId);
    setFilters({
      folders: already
        ? filters.folders.filter((f) => f.folderId !== folderId)
        : // Every importance by default: picking a subject should widen the
          // view, not silently narrow it.
          [...filters.folders, { folderId, importance: null }],
    });
  };

  const setImportance = (folderId: string, importance: Importance | null) => {
    setFilters({
      folders: filters.folders.map((f) =>
        f.folderId === folderId ? { ...f, importance } : f,
      ),
    });
  };

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
        <SelectField
          label="Classeurs"
          title="Classeurs"
          placeholder="Tous les classeurs"
          options={folders.map((folder) => ({
            value: folder.id,
            label: folder.name,
          }))}
          selected={filters.folders.map((f) => f.folderId)}
          onToggle={toggleFolder}
          emptyMessage="Aucun classeur pour l'instant."
        />

        {filters.folders.map((filter) => (
          <ImportanceRow
            key={filter.folderId}
            name={folders.find((f) => f.id === filter.folderId)?.name ?? "Classeur"}
            value={filter.importance}
            onChange={(importance) => setImportance(filter.folderId, importance)}
            allowAll
          />
        ))}

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
