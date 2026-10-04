import { Image, StyleSheet, Text, View } from "react-native";

import { CARD_TOP, FACE, FACE_BAND, NODE } from "./layout";
import type { Importance } from "../events/types";
import { palette } from "../../theme/palette";
import { inWax } from "../../theme/tint";
import { radius, shadow, space } from "../../theme/tokens";

/** Someone, as the drawing needs them — and no more than that. */
export type Face = {
  name: string;
  /** Ready to put in an Image, or null. */
  photo: string | null;
  /** "1769 – 1821", or empty. */
  dates: string;
  /**
   * The dominant colour of their first photograph, `#rrggbb`, or null.
   *
   * What the card is painted with, once `inWax` has given it the palette's
   * saturation and luminance. Null — nobody with a portrait, or a portrait
   * with no colour in it — leaves the card in wax, as every card was.
   */
  tint: string | null;
};

export type TreeFaceProps = {
  face: Face | undefined;
  importance: Importance;
  /** Ringed in ink: the one being worked on, or one already linked to it. */
  active?: boolean;
  /** Out of reach, or merely being pressed. */
  dimmed?: boolean;
  pressed?: boolean;
};

/**
 * Someone, drawn: a round portrait, a name, two dates, on a coloured card.
 *
 * **The card takes the colour of their first photograph** — its hue only, laid
 * in the palette's own saturation and luminance by `inWax`, so that a tree of
 * twenty people is no longer twenty identical orange cards while the cream
 * label goes on reading the same on every one of them. Somebody with no
 * portrait keeps the wax.
 *
 * Every face is the same size — that of a major figure. **Weight in the tree
 * is carried by opacity**: a minor figure recedes into the paper, a founder
 * sits full on it. Size was tried and given up, because shrinking a portrait
 * makes a face harder to recognise, and a likeness should stay legible
 * whatever rank it holds.
 *
 * The box is fixed and the portrait hangs from a band, so a generation reads
 * as one line and the connectors never move.
 *
 * Lifted out of `TreeNode` so a genealogy can be *looked at* as well as
 * built: the catalogue shows somebody else's tree with none of the gestures,
 * and two drawings of the same thing would have drifted apart the first time
 * either was touched.
 */
export function TreeFace({
  face,
  importance,
  active = false,
  dimmed = false,
  pressed = false,
}: TreeFaceProps) {
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={face?.name ?? "Personnage"}
      style={[
        styles.node,
        {
          opacity: dimmed ? 0.25 : pressed ? 0.6 : WEIGHT[importance],
        },
      ]}
    >
      {/* Drawn first so everything else sits over it; positioned rather than
          in the flow, since it begins halfway up the portrait. */}
      <View
        style={[
          styles.card,
          { backgroundColor: inWax(face?.tint) },
          active && styles.cardActive,
        ]}
      />

      {/* The band is what keeps the axis: the circle is centred in it, so its
          middle is always FACE_BAND / 2 below the top of the box. */}
      <View style={styles.band}>
        <View style={styles.face}>
          {face?.photo ? (
            <Image source={{ uri: face.photo }} style={styles.image} />
          ) : (
            <Text style={styles.initial}>
              {face?.name.charAt(0).toUpperCase() ?? "?"}
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {face?.name ?? "Supprimé"}
      </Text>
      {face === undefined || face.dates === "" ? null : (
        <Text style={styles.dates} numberOfLines={1}>
          {face.dates}
        </Text>
      )}
    </View>
  );
}

/**
 * How present a face is, by the weight its member carries.
 *
 * `low` stays well clear of the 0.25 a dimmed node uses while a line is
 * being drawn: "minor" and "out of reach right now" must not look alike.
 */
const WEIGHT: Record<Importance, number> = {
  high: 1,
  medium: 0.78,
  low: 0.5,
};

const styles = StyleSheet.create({
  node: {
    width: NODE.width,
    height: NODE.height,
    alignItems: "center",
    gap: 3,
  },
  /**
   * The ground is set inline rather than here: a card borrows the colour of
   * the person's first photograph, and the wax in this sheet is only what a
   * person without one gets. `inWax` holds both cases.
   */
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    top: CARD_TOP,
    bottom: 0,
    borderRadius: radius.lg,
    ...shadow.soft,
  },
  /**
   * Ink, and not a brighter wax: the active state has to read against the
   * card it sits on, and dark-on-colour is the only pair that does. It holds
   * whatever hue the card borrowed, because `inWax` gives them all the wax's
   * luminance — so the ring is exactly as visible on a blue card as on a red.
   */
  cardActive: { borderWidth: 3, borderColor: palette.ink },
  band: {
    width: NODE.width,
    height: FACE_BAND,
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperLight,
    // Cream, because this ring crosses two grounds: paper above, wax below.
    borderWidth: 3,
    borderColor: palette.paperLight,
    ...shadow.soft,
  },
  // Clipped to the circle by the parent's radius — which is why the portrait
  // is a child of the frame rather than the frame itself.
  image: { width: "100%", height: "100%", borderRadius: 999 },
  initial: { fontSize: FACE * 0.36, fontWeight: "700", color: palette.inkFaint },
  /**
   * Sized to the room the card actually has.
   *
   * Below the portrait's band sit 74 points. A name on two lines at this
   * size takes 40, the dates 16, the spacing 8 — 64 in all, which leaves the
   * card a margin at the foot rather than text pressed against its edge.
   */
  name: {
    marginTop: space.xs,
    paddingHorizontal: space.sm,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: palette.paperLight,
    textAlign: "center",
  },
  dates: {
    fontSize: 13,
    lineHeight: 16,
    color: palette.paperLight,
    opacity: 0.78,
    textAlign: "center",
  },
});
