import { Image, StyleSheet } from "react-native";

import { GlyphButton } from "../../../components/ui";

const EVENT = require("../../../../assets/icons/event-add.png");
const PEOPLE = require("../../../../assets/icons/people.png");

/**
 * The two halves of making something.
 *
 * One `+` used to open a sheet with four tabs, which asked the reader to find
 * the right one among things that have little to do with each other. Split in
 * two, each button opens on what it says: what happened, or who it happened
 * to. Two tabs apiece instead of four, and each pair is a real pair — an
 * event belongs to folders, a person stands in trees.
 */
export function AddEventButton({ onPress }: { onPress: () => void }) {
  return (
    <GlyphButton accessibilityLabel="Ajouter un événement" onPress={onPress}>
      <Image source={EVENT} style={styles.glyph} resizeMode="contain" />
    </GlyphButton>
  );
}

export function AddPersonButton({ onPress }: { onPress: () => void }) {
  return (
    <GlyphButton
      accessibilityLabel="Personnages et arbres"
      onPress={onPress}
    >
      <Image source={PEOPLE} style={styles.glyph} resizeMode="contain" />
    </GlyphButton>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 23, height: 23 },
});
