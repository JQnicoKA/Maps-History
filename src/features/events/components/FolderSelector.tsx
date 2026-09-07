import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { Chip, InkButton } from "../../../components/ui";
import type { EventFolderLink, Folder, Importance } from "../types";
import { palette } from "../../../theme/palette";

const IMPORTANCES: { value: Importance; label: string }[] = [
  { value: "high", label: "Élevée" },
  { value: "medium", label: "Moyenne" },
  { value: "low", label: "Faible" },
];

export type FolderSelectorProps = {
  folders: Folder[];
  value: EventFolderLink[];
  onChange: (links: EventFolderLink[]) => void;
  onCreate: (name: string) => Promise<Folder>;
};

/**
 * Picks the folders an event belongs to, then its importance *within each one* —
 * the same event can be major to one subject and incidental to another.
 */
export function FolderSelector({
  folders,
  value,
  onChange,
  onCreate,
}: FolderSelectorProps) {
  const [newFolder, setNewFolder] = useState("");
  const [creating, setCreating] = useState(false);

  const toggle = (folderId: string) => {
    const existing = value.find((link) => link.folderId === folderId);
    onChange(
      existing
        ? value.filter((link) => link.folderId !== folderId)
        : [...value, { folderId, importance: "medium" }],
    );
  };

  const setImportance = (folderId: string, importance: Importance) => {
    onChange(
      value.map((link) =>
        link.folderId === folderId ? { ...link, importance } : link,
      ),
    );
  };

  const create = async () => {
    const name = newFolder.trim();
    if (name === "") return;
    setCreating(true);
    try {
      const folder = await onCreate(name);
      onChange([...value, { folderId: folder.id, importance: "medium" }]);
      setNewFolder("");
    } catch (cause) {
      Alert.alert(
        "Classeur non créé",
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Classeurs</Text>

      {folders.length > 0 ? (
        <View style={styles.chips}>
          {folders.map((folder) => (
            <Chip
              key={folder.id}
              label={folder.name}
              selected={value.some((link) => link.folderId === folder.id)}
              onPress={() => toggle(folder.id)}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.createRow}>
        <TextInput
          value={newFolder}
          onChangeText={setNewFolder}
          placeholder="Nouveau classeur…"
          placeholderTextColor={palette.inkFaint}
          style={styles.createInput}
          onSubmitEditing={() => void create()}
        />
        <InkButton
          label={creating ? "…" : "Créer"}
          disabled={creating || newFolder.trim() === ""}
          onPress={() => void create()}
        />
      </View>

      {value.map((link) => {
        const name =
          folders.find((f) => f.id === link.folderId)?.name ?? "Classeur";
        return (
          <View key={link.folderId} style={styles.importanceRow}>
            <Text style={styles.folderName} numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.chips}>
              {IMPORTANCES.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={link.importance === option.value}
                  onPress={() => setImportance(link.folderId, option.value)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: {
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: palette.inkSoft,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  createRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  createInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: palette.inkFaint,
    paddingVertical: 6,
    fontSize: 14,
    color: palette.ink,
  },
  importanceRow: {
    gap: 5,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.inkFaint,
  },
  folderName: { fontSize: 12, color: palette.ink },
});
