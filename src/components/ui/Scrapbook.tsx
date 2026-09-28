import { Image, StyleSheet, Text, View } from "react-native";

import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

const GRAIN = require("../../../assets/textures/paper-grain.png");

/**
 * The travel-journal furniture: tilted cards, drawn rules, paper.
 *
 * A notebook someone fills by hand is the honest metaphor for this app — you
 * do not *consult* HistoryNote, you paste things into it — and the furniture
 * that goes with it is furniture anyone recognises: a photograph stuck on
 * slightly crooked, a line drawn under a heading, a dashed outline where the
 * next one will go.
 *
 * The tilt is the whole trick and it is worth being careful about. Enough to
 * read as placed by a hand, never enough to read as broken: past about a
 * degree and a half a list stops looking charming and starts looking wrong.
 */

/** Paper fibre, behind a panel. The same the map wears, at a whisper. */
export function Grain({ opacity = 0.22 }: { opacity?: number }) {
  // Wrapped, because an Image takes no `pointerEvents` of its own and this
  // must never intercept a touch meant for what it sits behind.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={GRAIN}
        style={[StyleSheet.absoluteFill, { opacity }]}
        resizeMode="repeat"
      />
    </View>
  );
}

/**
 * How far a card leans, by its place in a list.
 *
 * Alternating rather than random: a random tilt changes every time React
 * re-renders, and a list that shuffles itself while you read it is not
 * charming, it is haunted. Derived from the index, it is the same on every
 * render and the page settles.
 */
export const lean = (index: number): string =>
  `${index % 2 === 0 ? -0.5 : 0.6}deg`;

export type JournalTitleProps = {
  title: string;
  hint?: string;
};

/** A page's heading: the name, and a line drawn under it. */
export function JournalTitle({ title, hint }: JournalTitleProps) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.underline} />
      {hint === undefined || hint === "" ? null : (
        <Text style={styles.hint}>{hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { alignItems: "center", paddingTop: space.sm },
  title: {
    ...type.plate,
    color: palette.ink,
    textAlign: "center",
  },
  /**
   * Drawn under the words rather than across the panel, and a touch wider
   * than the text: a line someone put there, not a border.
   */
  underline: {
    height: 3,
    borderRadius: radius.pill,
    alignSelf: "center",
    backgroundColor: palette.paperDeep,
    marginTop: 4,
    paddingHorizontal: space.xl,
    minWidth: 64,
    width: "42%",
  },
  hint: {
    ...type.caption,
    color: palette.inkSoft,
    textAlign: "center",
    marginTop: space.sm,
    paddingHorizontal: space.xl,
  },
});
