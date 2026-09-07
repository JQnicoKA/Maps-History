import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Chip, Paper } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import type { Importance } from "../events/types";
import { palette } from "../../theme/palette";

const IMPORTANCES: { value: Importance; label: string }[] = [
  { value: "high", label: "Élevée" },
  { value: "medium", label: "Moyenne" },
  { value: "low", label: "Faible" },
];

export function FilterBar() {
  const { folders, filters, setFilters } = useEvents();

  return (
    <Paper>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.legend}>Classeur</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              <Chip
                label="Tous"
                selected={filters.folderId === null}
                onPress={() => setFilters({ ...filters, folderId: null })}
              />
              {folders.map((folder) => (
                <Chip
                  key={folder.id}
                  label={folder.name}
                  selected={filters.folderId === folder.id}
                  onPress={() => setFilters({ ...filters, folderId: folder.id })}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.row}>
          <Text style={styles.legend}>Importance</Text>
          <View style={styles.chips}>
            <Chip
              label="Toutes"
              selected={filters.importance === null}
              onPress={() => setFilters({ ...filters, importance: null })}
            />
            {IMPORTANCES.map(({ value, label }) => (
              <Chip
                key={value}
                label={label}
                selected={filters.importance === value}
                onPress={() => setFilters({ ...filters, importance: value })}
              />
            ))}
          </View>
        </View>
      </View>
    </Paper>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  row: { gap: 5 },
  legend: {
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: palette.inkFaint,
  },
  chips: { flexDirection: "row", gap: 6 },
});
