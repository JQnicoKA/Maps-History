import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { NODE } from "./layout";
import { lifespan } from "../events/lifespan";
import { describeMark, type Character, type TreeMember } from "../events/types";
import { palette } from "../../theme/palette";
import { radius, space } from "../../theme/tokens";

/**
 * How present a member is on the plate.
 *
 * The scale is the weight of the person *in this genealogy*, not in history:
 * a minor cousin drawn as faintly as a founder would make the tree unreadable,
 * and the reader is the one who knows which is which.
 */
const WEIGHT: Record<TreeMember["importance"], { opacity: number; ring: number }> =
  {
    high: { opacity: 1, ring: 3 },
    medium: { opacity: 0.82, ring: 2 },
    low: { opacity: 0.52, ring: 1 },
  };

export type TreeNodeProps = {
  member: TreeMember;
  person: Character | undefined;
  x: number;
  y: number;
  /** Ringed in wax: the one being worked on, or a child being chosen. */
  active?: boolean;
  onPress: () => void;
};

export function TreeNode({
  member,
  person,
  x,
  y,
  active = false,
  onPress,
}: TreeNodeProps) {
  const weight = WEIGHT[member.importance];
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
        { left: x, top: y, opacity: pressed ? 0.6 : weight.opacity },
      ]}
    >
      <View
        style={[
          styles.face,
          {
            borderWidth: weight.ring,
            borderColor: active ? palette.wax : palette.ink,
          },
        ]}
      >
        {face ? (
          <Image source={{ uri: face.url }} style={styles.image} />
        ) : (
          <Text style={styles.initial}>
            {person?.name.charAt(0).toUpperCase() ?? "?"}
          </Text>
        )}
      </View>

      {/* The mark rides the portrait rather than the name: it is about the
          life, and it has to be legible at a glance over a whole tree. */}
      {mark ? (
        <View style={styles.mark}>
          <Text style={styles.markGlyph}>{mark.emoji}</Text>
        </View>
      ) : null}

      {member.note ? <View style={styles.hasNote} /> : null}

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

const FACE = 78;

const styles = StyleSheet.create({
  node: {
    position: "absolute",
    width: NODE.width,
    height: NODE.height,
    alignItems: "center",
    gap: 3,
  },
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperLight,
  },
  image: { width: "100%", height: "100%" },
  initial: { fontSize: 28, fontWeight: "700", color: palette.inkFaint },
  mark: {
    position: "absolute",
    top: -2,
    right: (NODE.width - FACE) / 2 - 11,
    width: 26,
    height: 26,
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
    top: FACE - 14,
    left: (NODE.width - FACE) / 2 - 4,
    width: 10,
    height: 10,
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
