import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import type { Look, SharedThing } from "./types";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

const THUMB = 54;

export type ThingRowProps = {
  one: SharedThing;
  look: Look;
  busy?: boolean;
  /** Opens it. Absent where the row is an inventory rather than a way in. */
  onOpen?: () => void;
  /** Takes it. Absent when what is being taken is the thing that holds it. */
  onTake?: () => void;
};

/**
 * One line of the catalogue: what it is, who wrote it, how many took it.
 *
 * Drawn wherever the community's work is listed, and that is the point of
 * lifting it out: a classeur's card shows the events inside it, and a list of
 * their titles said nothing a reader could judge a box by. The same row, with
 * its picture and its dates, makes the box legible.
 *
 * Inert without handlers — an inventory, not a set of doors.
 */
export function ThingRow({
  one,
  look,
  busy = false,
  onOpen,
  onTake,
}: ThingRowProps) {
  return (
    <Pressable
      accessibilityRole={onOpen ? "button" : "text"}
      accessibilityLabel={one.title}
      disabled={onOpen === undefined}
      onPress={onOpen}
      style={({ pressed }) => [styles.entry, pressed && styles.dim]}
    >
      <View style={styles.thumb}>
        {one.cover === null ? (
          <Text style={styles.emoji}>{look.glyph(one)}</Text>
        ) : (
          <Image source={{ uri: one.cover }} style={styles.thumbImage} />
        )}
      </View>

      <View style={styles.entryText}>
        <Text style={styles.entryTitle} numberOfLines={2}>
          {one.title}
        </Text>
        <Text style={styles.entryWhen}>{look.under(one)}</Text>
        <Text style={styles.entryWho} numberOfLines={1}>
          {one.mine ? "vous" : one.author}
          {one.stars > 0 ? ` · ★ ${one.stars}` : ""}
        </Text>
      </View>

      {/* The one thing to do with somebody else's work, on the line itself:
          reading it first is a choice, not a toll. */}
      {onTake === undefined ? null : one.mine ? null : one.copied ? (
        <Text style={styles.taken}>✓</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Copier ${one.title}`}
          hitSlop={8}
          disabled={busy}
          onPress={onTake}
          style={({ pressed }) => [styles.take, pressed && styles.dim]}
        >
          <Text style={styles.takeGlyph}>{busy ? "…" : "+"}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    ...shadow.soft,
  },
  dim: { opacity: 0.6 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 4,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.sunken,
  },
  thumbImage: { width: "100%", height: "100%" },
  emoji: { fontSize: 22 },
  entryText: { flex: 1, gap: 1 },
  entryTitle: { fontSize: 15, fontWeight: "700", color: palette.ink },
  entryWhen: { ...type.legend, color: palette.wax, fontWeight: "600" },
  entryWho: { ...type.legend, color: palette.inkFaint },
  take: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
  },
  takeGlyph: {
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "700",
    color: palette.paperLight,
  },
  taken: { fontSize: 18, color: palette.forest, paddingHorizontal: space.sm },
});
