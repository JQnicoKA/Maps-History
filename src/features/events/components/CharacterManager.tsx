import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text } from "react-native";

import { CharacterEditModal } from "./CharacterEditModal";
import { Roster, RosterEmpty, RosterRow } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { lifespan } from "../lifespan";
import type { Character } from "../types";
import { palette } from "../../../theme/palette";
import { space } from "../../../theme/tokens";

/**
 * The people the collection knows about.
 *
 * Same shape as the folders' half, because it is the same kind of thing: a
 * list, and one sheet behind both the slot at the top and the pencil on a
 * row. A folder is a subject an event belongs to; a character is someone it
 * was about. Both are ways of saying what an event is *of*.
 */
export function CharacterManager() {
  const { characters, events } = useEvents();
  const [editing, setEditing] = useState<Character | "new" | null>(null);

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      <Roster
        count={
          characters.length === 0
            ? "Aucun personnage"
            : `${characters.length} personnage${characters.length > 1 ? "s" : ""}`
        }
        addLabel="Nouveau personnage"
        onAdd={() => setEditing("new")}
      >
        {characters.length === 0 ? (
          <RosterEmpty>
            Un personnage est quelqu'un qu'un événement met en scène : on peut
            en lier plusieurs au même événement, et les relier entre eux dans
            un arbre.
          </RosterEmpty>
        ) : (
          characters.map((person) => {
            const appears = events.filter((event) =>
              event.characters.includes(person.id),
            ).length;
            const face = person.photos[0];
            return (
              <RosterRow
                key={person.id}
                thumb={
                  face ? (
                    <Image source={{ uri: face.url }} style={styles.image} />
                  ) : (
                    <Text style={styles.initial}>
                      {person.name.charAt(0).toUpperCase()}
                    </Text>
                  )
                }
                title={person.name}
                detail={[
                  lifespan(person),
                  appears === 0
                    ? "jamais cité"
                    : `${appears} événement${appears > 1 ? "s" : ""}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                onEdit={() => setEditing(person)}
                editLabel={`Modifier ${person.name}`}
              />
            );
          })
        )}
      </Roster>

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
  image: { width: "100%", height: "100%" },
  initial: { fontSize: 18, fontWeight: "700", color: palette.inkFaint },
});
