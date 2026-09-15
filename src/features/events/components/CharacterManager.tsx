import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CharacterEditModal } from "./CharacterEditModal";
import { useEvents } from "../EventsProvider";
import { lifespan } from "../lifespan";
import type { Character } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, type } from "../../../theme/tokens";

const PENCIL = require("../../../../assets/icons/pencil.png");

/** Round, like the marker a face may end up in. */
const THUMB = 44;

/** The pencil's tile. Smaller than the portrait, so it never competes. */
const EDIT = 36;

/**
 * The people the collection knows about.
 *
 * Same shape as the folders' half, because it is the same kind of thing: a
 * list, and one sheet behind both the slot at the top and the pencil on a row.
 * A folder is a subject an event belongs to; a character is someone it was
 * about. Both are ways of saying what an event is *of*.
 */
export function CharacterManager() {
  const { characters, events } = useEvents();
  const [editing, setEditing] = useState<Character | "new" | null>(null);

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.list}>
        <Text style={styles.legend}>
          {characters.length === 0
            ? "Aucun personnage"
            : `${characters.length} personnage${characters.length > 1 ? "s" : ""}`}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nouveau personnage"
          onPress={() => setEditing("new")}
          style={({ pressed }) => [styles.new, pressed && styles.pressed]}
        >
          <View style={styles.newThumb}>
            <Text style={styles.newGlyph}>+</Text>
          </View>
          <Text style={styles.newLabel}>Nouveau personnage</Text>
        </Pressable>

        {characters.length === 0 ? (
          <Text style={styles.empty}>
            Un personnage est quelqu'un qu'un événement met en scène : on peut
            en lier plusieurs au même événement.
          </Text>
        ) : (
          characters.map((person) => {
            const appears = events.filter((event) =>
              event.characters.includes(person.id),
            ).length;
            const face = person.photos[0];
            return (
              <View key={person.id} style={styles.row}>
                <View style={styles.thumb}>
                  {face ? (
                    <Image source={{ uri: face.url }} style={styles.image} />
                  ) : (
                    <Text style={styles.initial}>
                      {person.name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {person.name}
                  </Text>
                  <Text style={styles.detail} numberOfLines={1}>
                    {[
                      lifespan(person),
                      appears === 0
                        ? "jamais cité"
                        : `${appears} événement${appears > 1 ? "s" : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Modifier ${person.name}`}
                  hitSlop={8}
                  onPress={() => setEditing(person)}
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

      {/* Keyed on the person: the sheet seeds its fields from whoever it opens
          on, and without a remount it would keep the first one's. */}
      <CharacterEditModal
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
  list: { gap: space.sm },
  legend: { ...type.legend, color: palette.inkSoft },
  empty: { ...type.body, color: palette.inkFaint },
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
  image: { width: "100%", height: "100%" },
  initial: { fontSize: 17, fontWeight: "700", color: palette.inkFaint },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: "600", color: palette.ink },
  detail: { ...type.caption, color: palette.inkFaint },
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
  pressed: { opacity: 0.5 },
});
