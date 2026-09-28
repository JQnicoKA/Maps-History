import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { formatDateYear } from "../historicalDate";
import type { Character } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space } from "../../../theme/tokens";

export type CharacterMarkerProps = {
  person: Character;
  onPress: () => void;
};

const SIZE = 46;

/**
 * Someone standing on the plate: a portrait in a cameo, their name under it.
 *
 * Squared off where an event's locket is round, and that is the whole of what
 * separates the two at a glance. Both are photographs pinned to a map; only
 * the frame says which is a thing that happened and which is a person it
 * happened to.
 *
 * The name is carried rather than left for a tap: several people can share a
 * century, and a row of anonymous faces is a puzzle. It is the one label on
 * the map that answers its own question.
 */
export function CharacterMarker({ person, onPress }: CharacterMarkerProps) {
  const face = person.photos[0];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        person.birth
          ? `${person.name}, né en ${formatDateYear(person.birth)}`
          : person.name
      }
      onPress={onPress}
      style={({ pressed }) => [styles.stack, pressed && styles.pressed]}
    >
      <View style={styles.cameo}>
        {face ? (
          <Image source={{ uri: face.url }} style={styles.photo} />
        ) : (
          <Text style={styles.initial}>
            {person.name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>

      <View style={styles.plate}>
        <Text style={styles.name} numberOfLines={1}>
          {person.name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: "center" },
  pressed: { opacity: 0.7 },
  cameo: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: radius.sm,
    backgroundColor: palette.paperLight,
    borderWidth: 2,
    borderColor: palette.ink,
    shadowColor: palette.ink,
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  photo: { width: "100%", height: "100%" },
  initial: { fontSize: 19, fontWeight: "700", color: palette.inkFaint },
  /** A slip of paper under the cameo, just wide enough for the name. */
  plate: {
    maxWidth: 110,
    marginTop: -5,
    paddingHorizontal: space.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.ink,
  },
  name: { fontSize: 11, fontWeight: "700", color: palette.ink },
});
