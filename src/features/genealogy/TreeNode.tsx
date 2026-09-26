import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { CARD_TOP, FACE, FACE_BAND, NODE } from "./layout";
import { lifespan } from "../events/lifespan";
import type { Character, TreeMember } from "../events/types";
import { palette } from "../../theme/palette";
import { radius, shadow, space } from "../../theme/tokens";

export type TreeNodeProps = {
  member: TreeMember;
  person: Character | undefined;
  x: number;
  y: number;
  /** Ringed in wax: the one being worked on, or someone already linked to it. */
  active?: boolean;
  /**
   * Out of reach while a line is being drawn — the wrong generation for the
   * kind of link being traced. Faded rather than hidden: the reader still needs
   * to see where they are in the tree.
   */
  muted?: boolean;
  onPress: () => void;
};

/**
 * Someone, drawn: a round portrait, a name, two dates.
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
 * Behind the name and the lower half of the face sits a card in sealing wax —
 * the app's one accent, the colour of the year in the frieze. The portrait
 * overflows above it, which is what makes a face read as resting *on* a card
 * rather than being framed inside one.
 */
export function TreeNode({
  member,
  person,
  x,
  y,
  active = false,
  muted = false,
  onPress,
}: TreeNodeProps) {
  const face = person?.photos[0];
  const dates = person ? lifespan(person) : "";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={person?.name ?? "Personnage"}
      onPress={onPress}
      disabled={muted}
      style={({ pressed }) => [
        styles.node,
        {
          left: x,
          top: y,
          opacity: muted ? 0.25 : pressed ? 0.6 : WEIGHT[member.importance],
        },
      ]}
    >
      {/* Drawn first so everything else sits over it; positioned rather than
          in the flow, since it begins halfway up the portrait. */}
      <View style={[styles.card, active && styles.cardActive]} />

      {/* The band is what keeps the axis: the circle is centred in it, so its
          middle is always FACE_BAND / 2 below the top of the box. */}
      <View style={styles.band}>
        {/* The wax dot hangs off the portrait itself rather than off the box,
            so it follows it whatever size it is drawn at. */}
        <View style={styles.face}>
          {face ? (
            <Image source={{ uri: face.url }} style={styles.image} />
          ) : (
            <Text style={styles.initial}>
              {person?.name.charAt(0).toUpperCase() ?? "?"}
            </Text>
          )}

          {member.note ? <View style={styles.hasNote} /> : null}
        </View>
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {person?.name ?? "Supprimé"}
      </Text>
      {dates === "" ? null : (
        <Text style={styles.dates} numberOfLines={1}>
          {dates}
        </Text>
      )}
    </Pressable>
  );
}

const DOT = 10;

/**
 * How present a face is, by the weight its member carries.
 *
 * `low` stays well clear of the 0.25 a muted node uses while a line is being
 * drawn: "minor" and "out of reach right now" must not look alike.
 */
const WEIGHT: Record<TreeMember["importance"], number> = {
  high: 1,
  medium: 0.78,
  low: 0.5,
};

const styles = StyleSheet.create({
  node: {
    position: "absolute",
    width: NODE.width,
    height: NODE.height,
    alignItems: "center",
    gap: 3,
  },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    top: CARD_TOP,
    bottom: 0,
    borderRadius: radius.lg,
    backgroundColor: palette.wax,
    ...shadow.soft,
  },
  /**
   * Ink, and not a brighter wax: the active state has to read against the wax
   * it sits on, and dark-on-wax is the only pair that does.
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
  /** A dot of cream: there is something written about this one. */
  hasNote: {
    position: "absolute",
    bottom: 0,
    left: -2,
    width: DOT,
    height: DOT,
    borderRadius: radius.pill,
    backgroundColor: palette.paperLight,
    borderWidth: 1.5,
    borderColor: palette.wax,
  },
  /**
   * Sized to the room the card actually has.
   *
   * Below the portrait's band sit 74 points. A name on two lines at this size
   * takes 40, the dates 16, the spacing 8 — 64 in all, which leaves the card a
   * margin at the foot rather than text pressed against its edge.
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
