import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text } from "react-native";

import { FolderEditModal } from "./FolderEditModal";
import { Roster, RosterEmpty, RosterRow } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import type { Folder } from "../types";
import { palette } from "../../../theme/palette";
import { space } from "../../../theme/tokens";

/**
 * The subjects events are filed under.
 *
 * A folder is a subject, not a box: one event can sit in several, and it
 * carries a different importance in each. The cover shown here is the one the
 * map falls back to for an event that has no photograph of its own.
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
      <Roster
        count={
          folders.length === 0
            ? "Aucun classeur"
            : `${folders.length} classeur${folders.length > 1 ? "s" : ""}`
        }
        addLabel="Nouveau classeur"
        onAdd={() => setEditing("new")}
      >
        {folders.length === 0 ? (
          <RosterEmpty>
            Un classeur est un sujet : un événement peut appartenir à
            plusieurs, et compter plus dans l'un que dans l'autre.
          </RosterEmpty>
        ) : (
          folders.map((folder) => {
            const filed = events.filter((event) =>
              event.folders.some((link) => link.folderId === folder.id),
            ).length;
            return (
              <RosterRow
                key={folder.id}
                thumb={
                  folder.photo ? (
                    <Image
                      source={{ uri: folder.photo.url }}
                      style={styles.image}
                    />
                  ) : (
                    <Text style={styles.blank}>·</Text>
                  )
                }
                title={folder.name}
                detail={
                  filed === 0
                    ? "vide"
                    : `${filed} événement${filed > 1 ? "s" : ""}`
                }
                onEdit={() => setEditing(folder)}
                editLabel={`Modifier ${folder.name}`}
              />
            );
          })
        )}
      </Roster>

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

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  image: { width: "100%", height: "100%" },
  blank: { fontSize: 20, color: palette.inkFaint },
});
