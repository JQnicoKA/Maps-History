import { Image, ScrollView, StyleSheet, Text } from "react-native";

import { Roster, RosterEmpty, RosterRow } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { lifespan, placeOfPerson } from "../lifespan";
import type { Character } from "../types";

export type CharacterManagerProps = {
  /** Asks for someone's page, to be read. */
  onRead: (person: Character) => void;
  /** Asks for the form — on someone, or blank. */
  onEdit: (target: Character | "new") => void;
  /** Asks for the community's people. */
  onSeek: () => void;
};
import { palette } from "../../../theme/palette";
import { space } from "../../../theme/tokens";

/**
 * The people the collection knows about.
 *
 * Same shape as the folders' half, because it is the same kind of thing: a
 * list, and one sheet behind both the slot at the top and the pencil on a
 * row. A folder is a subject an event belongs to; a character is someone it
 * was about. Both are ways of saying what an event is *of*.
 *
 * The card itself is not opened here but asked for. A person now carries a
 * place on the map, and choosing one means handing the whole screen to the
 * reticle — which would tear down this list, and with it a half-typed card
 * nested inside it. Opened from the top of the screen instead, the card
 * outlives the trip to the map.
 */
export function CharacterManager({
  onRead,
  onEdit,
  onSeek,
}: CharacterManagerProps) {
  const { characters, events } = useEvents();

  return (
    <ScrollView
      style={styles.fill}
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
        onAdd={() => onEdit("new")}
        seekLabel="Chercher dans la chronique"
        seekDetail="Des personnages que d'autres ont déjà écrits, à prendre chez vous."
        onSeek={onSeek}
      >
        {characters.length === 0 ? (
          <RosterEmpty>
            Un personnage est quelqu'un qu'un événement met en scène : on peut
            en lier plusieurs au même événement, et les relier entre eux dans
            un arbre.
          </RosterEmpty>
        ) : (
          characters.map((person, rank) => {
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
                  // Said here rather than left to be discovered: the people
                  // written down before the map knew about them are absent
                  // from it, and nothing else on this row would explain why.
                  placeOfPerson(person) === null || person.birth === null
                    ? "à placer sur la carte"
                    : null,
                  appears === 0
                    ? "jamais cité"
                    : `${appears} événement${appears > 1 ? "s" : ""}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                index={rank}
                // The row reads, the pencil corrects — the same division the
                // map makes between a tap on an event and its "Modifier".
                onPress={() => onRead(person)}
                onEdit={() => onEdit(person)}
                editLabel={`Modifier ${person.name}`}
              />
            );
          })
        )}
      </Roster>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  image: { width: "100%", height: "100%" },
  initial: { fontSize: 18, fontWeight: "700", color: palette.inkFaint },
});
