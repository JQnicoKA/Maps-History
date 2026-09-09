import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";

import { ImportanceRow } from "./ImportanceRow";
import { InkButton, SelectField } from "../../../components/ui";
import type { EventFolderLink, Folder, Importance } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space } from "../../../theme/tokens";

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
    onChange(
      value.some((link) => link.folderId === folderId)
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
      <SelectField
        label="Classeurs"
        title="Classeurs"
        placeholder="Choisir un classeur…"
        options={folders.map((folder) => ({
          value: folder.id,
          label: folder.name,
        }))}
        selected={value.map((link) => link.folderId)}
        onToggle={toggle}
        emptyMessage="Aucun classeur. Créez le premier ci-dessous."
        footer={
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
        }
      />

      {value.map((link) => (
        <ImportanceRow
          key={link.folderId}
          name={folders.find((f) => f.id === link.folderId)?.name ?? "Classeur"}
          value={link.importance}
          onChange={(importance) =>
            setImportance(link.folderId, importance ?? "medium")
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.lg },
  createRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  createInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
    fontSize: 15,
    color: palette.ink,
  },
});
