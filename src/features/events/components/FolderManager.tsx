import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FolderEditModal } from "./FolderEditModal";
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
 * This half is a list and nothing else. Making a folder and changing one are
 * the same act — a name and a cover — so they are the same sheet, reached from
 * the slot at the top or from the pencil on a row.
 */
export function FolderManager() {
  const { folders, events } = useEvents();
  /** The folder whose sheet is open, `"new"` for the empty one. */
  const [editing, setEditing] = useState<Folder | "new" | null>(null);

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.list}>
        <Text style={styles.legend}>
          {folders.length === 0
            ? "Aucun classeur"
            : `${folders.length} classeur${folders.length > 1 ? "s" : ""}`}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nouveau classeur"
          onPress={() => setEditing("new")}
          style={({ pressed }) => [styles.new, pressed && styles.pressed]}
        >
          <View style={styles.newThumb}>
            <Text style={styles.newGlyph}>+</Text>
          </View>
          <Text style={styles.newLabel}>Nouveau classeur</Text>
        </Pressable>

        {folders.length === 0 ? (
          <Text style={styles.empty}>
            Un classeur est un sujet : un événement peut appartenir à plusieurs.
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
        key={editing === null ? "none" : editing === "new" ? "new" : editing.id}
        target={editing}
        onClose={() => setEditing(null)}
      />
    </ScrollView>
  );
}

const PENCIL = require("../../../../assets/icons/pencil.png");

/** Round, like the marker it feeds. */
const THUMB = 44;

/** The pencil's tile. Smaller than the cover, so it never competes with it. */
const EDIT = 36;

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  list: { gap: space.sm },
  // Dashed, like every other empty slot in this app: a place to fill rather
  // than a button competing with the rows below it.
  new: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.line,
  },
  newThumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  newGlyph: { fontSize: 24, lineHeight: 28, color: palette.inkSoft },
  newLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: palette.inkSoft },
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
   * A pale rounded square on the row's sunken ground. Square rather than round
   * so it reads as a control and not as a second portrait facing the cover —
   * and a bare glyph floating at the edge read as decoration rather than as a
   * button at all.
   */
  edit: {
    width: EDIT,
    height: EDIT,
    borderRadius: radius.md,
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
