import { StyleSheet, Text, View } from "react-native";

import { palette } from "../../theme/palette";
import { radius, space } from "../../theme/tokens";

export type SharePillProps = {
  shared: boolean;
};

/**
 * Whether this is in the community, said in one word at the top of a card.
 *
 * It replaced a ticked line at the foot of the detail sheet, and the move is
 * the point: down there it was a *control*, the last thing on the page, read
 * after everything else and offering a change nobody came to make. What a
 * reader actually wants from it is a fact — is this mine alone, or is it out
 * there — and a fact belongs at the top, beside the other two (what kind of
 * thing, and when). The change itself lives in the form, with the rest of
 * what can be edited.
 *
 * The two faces are deliberately unalike rather than one pill in two colours.
 * Shared is a stamp: filled wax, the colour this app uses for "something
 * happened here". Private is its absence: an outline, no fill, quiet ink —
 * nothing was stamped. A reader can tell them apart at a glance, which two
 * tints of the same shape never manage.
 */
export function SharePill({ shared }: SharePillProps) {
  return (
    <View style={[styles.pill, shared ? styles.stamped : styles.outlined]}>
      <Text style={[styles.word, shared ? styles.onWax : styles.onPaper]}>
        {shared ? "Partagé" : "Privé"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The same height and bite as the type badge beside it: they are two facts
  // on one line, and a pill a few pixels taller than its neighbour reads as a
  // mistake rather than as emphasis.
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  stamped: { backgroundColor: palette.wax, borderColor: palette.waxDeep },
  outlined: { backgroundColor: "transparent", borderColor: palette.line },
  word: { fontSize: 13, fontWeight: "600", letterSpacing: 0.2 },
  onWax: { color: palette.paperLight },
  onPaper: { color: palette.inkFaint },
});
