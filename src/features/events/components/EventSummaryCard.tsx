import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Paper } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { formatEventPeriod } from "../historicalDate";
import { describeType, type HistoricalEvent } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, type } from "../../../theme/tokens";

export type EventSummaryCardProps = {
  event: HistoricalEvent;
  onOpen: () => void;
  /** Marks the event being read when the tile sits among others in the list. */
  highlighted?: boolean;
};

export function EventSummaryCard({
  event,
  onOpen,
  highlighted = false,
}: EventSummaryCardProps) {
  const { folders } = useEvents();
  const photo = event.photos[0];
  const { emoji } = describeType(event.type);

  const names = event.folders
    .map((link) => folders.find((f) => f.id === link.folderId)?.name)
    .filter((name): name is string => name !== undefined);

  return (
    <Paper style={highlighted ? styles.highlighted : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Détail de ${event.title}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        {photo ? (
          <Image source={{ uri: photo.url }} style={styles.thumb} />
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
