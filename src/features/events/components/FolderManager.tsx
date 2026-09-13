import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FolderEditModal } from "./FolderEditModal";
import { InkButton, InkField } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import type { Folder } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, type } from "../../../theme/tokens";

/**
 * The folders themselves — the subjects an event can be filed under.
 *
 * They used to be created from inside the event form, in a cramped row under
 * the picker. Giving them their own half of the Add sheet means the event form
 * only ever *chooses* among folders that exist, which is one decision at a time
 * rather than two tangled together.
 *
 * A folder is written the moment it is named: there is nothing to save here,
 * and no Cancel to press. Everything else about it — its name, its cover —
 * is changed behind the pencil, where there is something to cancel.
 */
export function FolderManager() {
  const { folders, events, addFolder } = useEvents();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  /** The folder whose sheet is open, if any. */
  const [editing, setEditing] = useState<Folder | null>(null);

  /** Case-insensitive: two folders differing only in case are one folder. */
  const taken = (candidate: string) =>
    folders.some(
      (folder) => folder.name.toLowerCase() === candidate.toLowerCase(),
    );

  const create = async () => {
    const trimmed = name.trim();
    if (trimmed === "") return;

    if (taken(trimmed)) {
      Alert.alert("Classeur existant", `« ${trimmed} » est déjà dans la liste.`);
      return;
    }

    setCreating(true);
    try {
      await addFolder(trimmed);
      setName("");
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
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.createRow}>
        <View style={styles.createField}>
          <InkField
            label="Nom du classeur"
            value={name}
            onChangeText={setName}
            placeholder="Guerres de religion"
            onSubmitEditing={() => void create()}
          />
        </View>
        <InkButton
          label={creating ? "…" : "Ajouter"}
          variant="solid"
          disabled={creating || name.trim() === ""}
          onPress={() => void create()}
        />
      </View>

      <View style={styles.list}>
        <Text style={styles.legend}>
          {folders.length === 0
            ? "Aucun classeur"
            : `${folders.length} classeur${folders.length > 1 ? "s" : ""}`}
        </Text>

        {folders.length === 0 ? (
          <Text style={styles.empty}>
            Créez le premier ci-dessus. Un classeur est un sujet : un événement
            peut appartenir à plusieurs.
          </Text>
        ) : (
          folders.map((folder) => {
            const filed = events.filter((event) =>
              event.folders.some((link) => link.folderId === folder.id),
            ).length;
            return (
              <View key={folder.id} style={styles.row}>
                <View style={styles.thumb}>
                  {folder.photo ? (
                    <Image
                      source={{ uri: folder.photo.url }}
                      style={styles.image}
                    />
                  ) : (
                    <Text style={styles.plus}>·</Text>
                  )}
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {folder.name}
                  </Text>
                  <Text style={styles.count}>
                    {filed === 0
                      ? "vide"
                      : `${filed} événement${filed > 1 ? "s" : ""}`}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Modifier ${folder.name}`}
                  // The disc is 36pt; the slop brings the target past the 44
                  // the guidelines ask for without bloating the row.
                  hitSlop={8}
                  onPress={() => setEditing(folder)}
                  style={({ pressed }) => [
                    styles.edit,
                    pressed && styles.editPressed,
                  ]}
                >
                  <Image
                    source={PENCIL}
                    style={styles.pencil}
                    resizeMode="contain"
                  />
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      {/* Keyed on the folder: the sheet seeds its fields from the folder it
          opens on, and without a remount it would keep the first one's. */}
      <FolderEditModal
        key={editing?.id ?? "none"}
        folder={editing}
        onClose={() => setEditing(null)}
      />
    </ScrollView>
  );
}

const PENCIL = require("../../../../assets/icons/pencil.png");

/** Round, like the marker it feeds. */
const THUMB = 44;

/** The pencil's disc. Smaller than the cover, so it never competes with it. */
const EDIT = 36;

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  createRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  createField: { flex: 1 },
  list: { gap: space.sm },
  legend: { ...type.legend, color: palette.inkSoft },
  empty: { ...type.body, color: palette.inkFaint },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  pressed: { opacity: 0.5 },
  image: { width: "100%", height: "100%" },
  plus: { fontSize: 22, lineHeight: 26, color: palette.inkFaint },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: "600", color: palette.ink },
  /**
   * A pale disc on the row's sunken ground, mirroring the cover on the left —
   * a bare glyph floating at the edge read as decoration rather than a button.
   */
  edit: {
    width: EDIT,
    height: EDIT,
    borderRadius: EDIT / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  editPressed: { backgroundColor: palette.paperDeep },
  pencil: { width: 16, height: 16, opacity: 0.75 },
  count: { ...type.caption, color: palette.inkFaint },
});
