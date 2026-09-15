import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { FACE, FACE_BAND, NODE } from "./layout";
import { lifespan } from "../events/lifespan";
import { describeMark, type Character, type TreeMember } from "../events/types";
import { palette } from "../../theme/palette";
import { radius, space } from "../../theme/tokens";

export type TreeNodeProps = {
  member: TreeMember;
  person: Character | undefined;
  x: number;
  y: number;
  /** Ringed in wax: the one being worked on, or a child being chosen. */
  active?: boolean;
  onPress: () => void;
};

/**
 * Someone, drawn: a round portrait, a name, two dates.
 *
 * **The weight they carry in the tree sets the size of the face** — small for a
 * minor figure, larger for a founder. It used to set the opacity instead, which
 * was a mistake: a faded portrait reads as damaged or as still loading, not as
 * secondary. A small one reads as small.
 *
 * The box around it stays the same size for everyone, and the portrait hangs
 * from a band as tall as the largest face — so two people of the same
 * generation have their circles on one axis whatever their weight, and the row
 * reads as a line. The connectors attach to the box, so a tree does not redraw
 * every line because one person was promoted.
 */
export function TreeNode({
  member,
  person,
  x,
  y,
  active = false,
  onPress,
}: TreeNodeProps) {
  const size = FACE[member.importance];
  const face = person?.photos[0];
  const dates = person ? lifespan(person) : "";
  const mark = member.mark ? describeMark(member.mark) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={person?.name ?? "Personnage"}
      onPress={onPress}
      style={({ pressed }) => [
        styles.node,
        { left: x, top: y, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {/* The band is what keeps the axis: the circle is centred in it, so its
          middle is always FACE_BAND / 2 below the top of the box. */}
      <View style={styles.band}>
        {/* Badges hang off the portrait itself rather than off the box, so they
            follow it whatever size it is drawn at. */}
        <View
          style={[
            styles.face,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: active ? palette.wax : palette.ink,
            },
          ]}
        >
          {face ? (
            <Image source={{ uri: face.url }} style={styles.image} />
          ) : (
            <Text style={[styles.initial, { fontSize: size * 0.36 }]}>
              {person?.name.charAt(0).toUpperCase() ?? "?"}
            </Text>
          )}

          {mark ? (
            <View style={styles.mark}>
              <Text style={styles.markGlyph}>{mark.emoji}</Text>
            </View>
          ) : null}

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

const BADGE = 26;
const DOT = 10;

const styles = StyleSheet.create({
  node: {
    position: "absolute",
    width: NODE.width,
    height: NODE.height,
    alignItems: "center",
    gap: 3,
  },
  band: {
    width: NODE.width,
    height: FACE_BAND,
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperLight,
    borderWidth: 2.5,
  },
  // Clipped to the circle by the parent's radius — which is why the portrait
  // is a child of the frame rather than the frame itself.
  image: { width: "100%", height: "100%", borderRadius: 999 },
  initial: { fontWeight: "700", color: palette.inkFaint },
  mark: {
    position: "absolute",
    top: -4,
    right: -6,
    width: BADGE,
    height: BADGE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  markGlyph: { fontSize: 14 },
  /** A dot of wax: there is something written about this one. */
  hasNote: {
    position: "absolute",
    bottom: 0,
    left: -2,
    width: DOT,
    height: DOT,
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
    borderWidth: 1.5,
    borderColor: palette.paperLight,
  },
  name: {
    marginTop: space.xs,
    fontSize: 13,
    lineHeight: 15,
    fontWeight: "700",
    color: palette.ink,
    textAlign: "center",
  },
  dates: { fontSize: 11, color: palette.inkSoft, textAlign: "center" },
});
