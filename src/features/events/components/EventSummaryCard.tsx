import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Paper } from "../../../components/ui";
import { formatEventPeriod } from "../historicalDate";
import { describeType, type EventSummary } from "../types";
import { palette } from "../../../theme/palette";
import { radius, shadow, space, type } from "../../../theme/tokens";

export type EventSummaryCardProps = {
  event: EventSummary;
  onOpen: () => void;
  /** Marks the event being read when the tile sits among others in the list. */
  highlighted?: boolean;
  /**
   * La tuile flotte sur la planche plutôt que de vivre dans une liste.
   *
   * Elle y prend une ombre bien plus dense : sur un fond qui change tous les
   * dix points, rien d'autre ne la détache. Dans une liste, la même ombre
   * répétée trente fois ferait une page sale — c'est pourquoi c'est la
   * situation qui la demande, et non la tuile qui la porte toujours.
   */
  floating?: boolean;
};

export function EventSummaryCard({
  event,
  onOpen,
  highlighted = false,
  floating = false,
}: EventSummaryCardProps) {
  // The same picture the marker shows: the event's own first photograph, else
  // the type's emoji. Il y avait un troisième recours — la couverture d'un de
  // ses classeurs — et il est parti avec eux : un classeur n'est qu'un nom, il
  // ne porte pas d'image.
  const cover = event.cover?.url;
  const { emoji } = describeType(event.type);

  const names = event.folders;

  return (
    <Paper
      style={[
        floating ? styles.floating : null,
        highlighted ? styles.highlighted : null,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Détail de ${event.title}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        {cover ? (
          <Image source={{ uri: cover }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Text style={styles.thumbEmoji}>{emoji}</Text>
          </View>
        )}

        <View style={styles.text}>
          <Text style={styles.period}>{formatEventPeriod(event)}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          {names.length > 0 ? (
            <View style={styles.tags}>
              {names.slice(0, 2).map((name) => (
                <View key={name} style={styles.tag}>
                  <Text style={styles.tagLabel} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
              ))}
              {names.length > 2 ? (
                <Text style={styles.more}>+{names.length - 2}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Paper>
  );
}

const styles = StyleSheet.create({
  floating: { ...shadow.plate },
  highlighted: { borderColor: palette.wax, borderWidth: 1.5 },
  body: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    gap: space.md,
  },
  pressed: { opacity: 0.7 },
  thumb: { width: 56, height: 56, borderRadius: radius.md },
  thumbEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.sunken,
  },
  thumbEmoji: { fontSize: 22 },
  text: { flex: 1, gap: 3 },
  period: { fontSize: 12, color: palette.wax, fontWeight: "600" },
  title: { fontSize: 16, lineHeight: 21, color: palette.ink, fontWeight: "600" },
  tags: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: 2 },
  tag: {
    maxWidth: 130,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: palette.sunken,
  },
  tagLabel: { ...type.caption, color: palette.inkSoft },
  more: { ...type.caption, color: palette.inkFaint },
  chevron: { fontSize: 22, color: palette.inkFaint, paddingHorizontal: space.xs },
});
