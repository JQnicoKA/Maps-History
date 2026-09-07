import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Paper } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { formatEventPeriod } from "../historicalDate";
import { describeType, type HistoricalEvent } from "../types";
import { palette } from "../../../theme/palette";

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
        {event.photos[0] !== undefined ? (
          <Image source={{ uri: event.photos[0].url }} style={styles.thumb} />
        ) : null}

        <View style={styles.text}>
          <Text style={styles.period}>
            {describeType(event.type).emoji} {formatEventPeriod(event)}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          {names.length > 0 ? (
            <Text style={styles.folders} numberOfLines={1}>
              {names.join(" · ")}
            </Text>
          ) : null}
        </View>

      </Pressable>
    </Paper>
  );
}

const styles = StyleSheet.create({
  highlighted: { borderColor: palette.wax, borderWidth: 2 },
  body: { flexDirection: "row", alignItems: "center", padding: 10, gap: 10 },
  pressed: { opacity: 0.75 },
  thumb: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderColor: palette.inkFaint,
  },
  text: { flex: 1, gap: 2 },
  period: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.wax,
  },
  title: { fontSize: 15, color: palette.ink },
  folders: { fontSize: 11, color: palette.inkFaint },
});
