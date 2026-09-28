import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { lean } from "./Scrapbook";
import { palette } from "../../theme/palette";
import { radius, shadow, space, TOUCH, type } from "../../theme/tokens";

const PENCIL = require("../../../assets/icons/pencil.png");

/** Round, like the marker a face or a cover may end up in. */
export const THUMB = 46;

export type RosterProps = {
  /** "3 classeurs", "Aucun personnage" — the count, said in words. */
  count: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
};

/**
 * The shape every list in the Add sheet takes.
 *
 * Folders, characters and trees were each drawing their own version of the
 * same thing — a count, a dashed slot to make one more, then rows — and the
 * three had drifted apart in spacing, in radius, in the size of a thumbnail.
 * They share it now, so a change to the way a list feels is made once.
 */
export function Roster({
  count,
  addLabel,
  onAdd,
  children,
}: RosterProps) {
  return (
    <View style={styles.list}>
      <Text style={styles.count}>{count}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        onPress={onAdd}
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}
      >
        <View style={styles.plus}>
          <Text style={styles.plusGlyph}>+</Text>
        </View>
        <Text style={styles.addLabel}>{addLabel}</Text>
      </Pressable>

      {children}
    </View>
  );
}

/** Shown in place of the rows, when there are none. */
export function RosterEmpty({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export type RosterRowProps = {
  /** A picture, an initial, an emoji — whatever stands for this one. */
  thumb: ReactNode;
  title: string;
  detail?: string;
  /** The pencil, when there is something to edit. */
  onEdit?: () => void;
  editLabel?: string;
  /** The whole row, when the row itself opens something. */
  onPress?: () => void;
  /**
   * Its place in the list, which decides which way it leans.
   *
   * Alternating and not random: a random tilt changes on every render, and a
   * list that reshuffles itself while you read it is not charming.
   */
  index?: number;
};

export function RosterRow({
  thumb,
  title,
  detail,
  onEdit,
  editLabel,
  onPress,
  index = 0,
}: RosterRowProps) {
  const body = (
    <>
      {/* The picture leans the other way from its card, the way a photograph
          stuck on a page never quite lines up with it. */}
      <View style={[styles.thumb, { transform: [{ rotate: lean(index + 1) }] }]}>
        {thumb}
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {detail === undefined || detail === "" ? null : (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
      {onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editLabel ?? "Modifier"}
          hitSlop={8}
          onPress={onEdit}
          style={({ pressed }) => [styles.edit, pressed && styles.editPressed]}
        >
          <Image source={PENCIL} style={styles.pencil} resizeMode="contain" />
        </Pressable>
      ) : null}
      {onPress && !onEdit ? <Text style={styles.chevron}>›</Text> : null}
    </>
  );

  const tilt = { transform: [{ rotate: lean(index) }] };
  if (!onPress) return <View style={[styles.row, tilt]}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, tilt, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const EDIT = 36;

const styles = StyleSheet.create({
  list: { gap: space.md },
  count: {
    ...type.legend,
    color: palette.inkSoft,
    alignSelf: "center",
    paddingBottom: space.xs,
  },
  empty: {
    ...type.body,
    color: palette.inkFaint,
    textAlign: "center",
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
  },

  /**
   * The empty space where the next one will be stuck.
   *
   * Dashed and unfilled, leaning the other way from the cards above it: it
   * is a gap in the page rather than a thing on it, and the difference is
   * what makes it read as an invitation.
   */
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: palette.paperDeep,
    transform: [{ rotate: "0.7deg" }],
  },
  plus: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperDeep,
  },
  plusGlyph: { fontSize: 25, lineHeight: 29, color: palette.paperLight },
  addLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: palette.inkSoft },

  /** A card stuck on the page: white paper, a soft shadow, square corners. */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: THUMB + 2 * space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    ...shadow.soft,
  },
  /**
   * A photograph, not a badge: square with a white border, the way a print
   * pasted in a notebook keeps its margin.
   */
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 4,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.sunken,
    borderWidth: 3,
    borderColor: palette.paperLight,
    ...shadow.soft,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15.5, fontWeight: "700", color: palette.ink },
  detail: { ...type.caption, color: palette.inkFaint },

  edit: {
    width: EDIT,
    height: EDIT,
    minWidth: TOUCH - 8,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.sunken,
  },
  editPressed: { backgroundColor: palette.paperDeep },
  pencil: { width: 16, height: 16, opacity: 0.75 },
  chevron: { fontSize: 22, color: palette.inkFaint, paddingRight: space.xs },
  pressed: { opacity: 0.55 },
});
