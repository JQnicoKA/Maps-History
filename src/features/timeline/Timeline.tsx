import { Pressable, StyleSheet, Text, View } from "react-native";

import { Paper } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { formatYear, toSortKey } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

/**
 * The chronological span of whatever the filters select. A track with the
 * travelled part filled, a dot per event, and the year being read floating
 * above it — the shape a current app uses for a scrubber, in the plate's ink.
 */
export function Timeline() {
  const { visibleEvents, selectedEvent, selectEvent } = useEvents();

  if (visibleEvents.length === 0) {
    return (
      <Paper>
        <Text style={styles.empty}>Aucun événement pour ces filtres.</Text>
      </Paper>
    );
  }

  const keys = visibleEvents.map((event) => toSortKey(event.start));
  const first = Math.min(...keys);
  const last = Math.max(...keys);
  const span = last - first;
  const shareOf = (index: number) =>
    span === 0 ? 0.5 : (keys[index]! - first) / span;

  const current = visibleEvents.findIndex(
    (event) => event.id === selectedEvent?.id,
  );
  const progress = current === -1 ? 0 : shareOf(current);

  return (
    <Paper>
      <View style={styles.body}>
        <View style={styles.caption}>
          {selectedEvent && current !== -1 ? (
            <View style={[styles.pill, { left: `${progress * 100}%` }]}>
              <Text style={styles.pillText} numberOfLines={1}>
                {formatYear(selectedEvent.start.year)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.track}>
          <View style={styles.rail} />
          <View style={[styles.railFilled, { width: `${progress * 100}%` }]} />

          {visibleEvents.map((event, index) => {
            const selected = event.id === selectedEvent?.id;
            return (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={event.title}
                onPress={() => selectEvent(event.id)}
                style={[styles.target, { left: `${shareOf(index) * 100}%` }]}
              >
                <View style={[styles.dot, selected && styles.dotSelected]} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.bounds}>
          <Text style={styles.bound}>
            {formatYear(visibleEvents[0]!.start.year)}
          </Text>
          <Text style={styles.bound}>
            {formatYear(visibleEvents[visibleEvents.length - 1]!.start.year)}
          </Text>
        </View>
      </View>
    </Paper>
  );
}

const TARGET = 28;
const PILL = 74;

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  caption: { height: 26 },
  pill: {
    position: "absolute",
    width: PILL,
    marginLeft: -PILL / 2,
    alignItems: "center",
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: palette.paperLight,
  },
  track: { height: TARGET, justifyContent: "center" },
  rail: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.sunken,
  },
  railFilled: {
    position: "absolute",
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.inkFaint,
  },
  target: {
    position: "absolute",
    width: TARGET,
    marginLeft: -TARGET / 2,
    height: TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: palette.inkSoft,
  },
  dotSelected: {
    width: 14,
    height: 14,
    backgroundColor: palette.wax,
    borderWidth: 3,
    borderColor: palette.paperLight,
  },
  bounds: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space.xs,
  },
  bound: { ...type.caption, color: palette.inkFaint },
  empty: {
    paddingVertical: space.xl,
    textAlign: "center",
    ...type.body,
    color: palette.inkSoft,
  },
});
