import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { palette } from "../../theme/palette";
import { radius, space, TOUCH, type } from "../../theme/tokens";

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
};

export function RosterRow({
  thumb,
  title,
  detail,
  onEdit,
  editLabel,
  onPress,
}: RosterRowProps) {
  const body = (
    <>
      <View style={styles.thumb}>{thumb}</View>
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

  if (!onPress) return <View style={styles.row}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const EDIT = 36;

const styles = StyleSheet.create({
  list: { gap: space.sm },
  count: { ...type.legend, color: palette.inkSoft },
  empty: { ...type.body, color: palette.inkFaint, paddingVertical: space.sm },

  /** Dashed, because it is a place for something rather than a thing. */
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.line,
  },
  plus: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  plusGlyph: { fontSize: 25, lineHeight: 29, color: palette.inkSoft },
  addLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: palette.inkSoft },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: THUMB + 2 * space.sm,
    padding: space.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.sunken,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "600", color: palette.ink },
  detail: { ...type.caption, color: palette.inkFaint },

  edit: {
    width: EDIT,
    height: EDIT,
    minWidth: TOUCH - 8,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  editPressed: { backgroundColor: palette.paperDeep },
  pencil: { width: 16, height: 16, opacity: 0.75 },
  chevron: { fontSize: 22, color: palette.inkFaint, paddingRight: space.xs },
  pressed: { opacity: 0.55 },
});
