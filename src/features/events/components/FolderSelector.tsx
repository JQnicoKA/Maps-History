import { StyleSheet, View } from "react-native";

import { ImportanceRow } from "./ImportanceRow";
import { SelectField } from "../../../components/ui";
import type { EventFolderLink, Folder, Importance } from "../types";
import { space } from "../../../theme/tokens";

export type FolderSelectorProps = {
  folders: Folder[];
  value: EventFolderLink[];
  onChange: (links: EventFolderLink[]) => void;
};

/**
 * Picks the folders an event belongs to, then its importance *within each one* —
 * the same event can be major to one subject and incidental to another.
 *
 * Choosing only. Folders are made in the Add sheet's other half, so filing an
 * event never turns into inventing a subject halfway through the form.
 */
export function FolderSelector({
  folders,
  value,
  onChange,
}: FolderSelectorProps) {
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
        emptyMessage="Aucun classeur. Créez-en un dans « Nouveau classeur »."
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
});
