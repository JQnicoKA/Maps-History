import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { InkButton, Paper, SelectField } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { ImportanceRow } from "../events/components/ImportanceRow";
import { NO_FILTERS, type Importance } from "../events/types";
import { palette } from "../../theme/palette";

export type FilterModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function FilterModal({ visible, onClose }: FilterModalProps) {
  const { folders, filters, setFilters, visibleEvents } = useEvents();
  const insets = useSafeAreaInsets();

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

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={[
            styles.wrapper,
            { marginTop: insets.top + 32, marginBottom: insets.bottom + 32 },
          ]}
        >
          <Paper>
            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.heading}>Filtres</Text>

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
                  name={
                    folders.find((f) => f.id === filter.folderId)?.name ??
                    "Classeur"
                  }
                  value={filter.importance}
                  onChange={(importance) =>
                    setImportance(filter.folderId, importance)
                  }
                  allowAll
                />
              ))}

              <Text style={styles.count}>
                {visibleEvents.length} événement
                {visibleEvents.length > 1 ? "s" : ""} affiché
                {visibleEvents.length > 1 ? "s" : ""}
              </Text>

              <View style={styles.actions}>
                <InkButton
                  label="Tout afficher"
                  variant="quiet"
                  disabled={filters.folders.length === 0}
                  onPress={() => setFilters(NO_FILTERS)}
                />
                <InkButton label="Fermer" variant="solid" onPress={onClose} />
              </View>
            </ScrollView>
          </Paper>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(58, 44, 27, 0.45)",
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  wrapper: { maxHeight: "100%" },
  body: { padding: 16, gap: 12 },
  heading: {
    fontSize: 13,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: palette.ink,
    textAlign: "center",
  },
  count: { fontSize: 11, color: palette.inkFaint, textAlign: "center" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});
