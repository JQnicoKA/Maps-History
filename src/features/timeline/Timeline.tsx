import { Pressable, StyleSheet, Text, View } from "react-native";

import { Paper } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { formatYear, toSortKey } from "../events/historicalDate";
import { palette } from "../../theme/palette";

/** Alternating fills, the way a scale bar is engraved on an atlas plate. */
const GRADUATIONS = 24;

/**
 * The chronological span of whatever the filters select, drawn as the graduated
 * scale bar of an old map: events are lozenges above the rule, the one under
 * the reader's eye is inked in wax and carries its year.
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

  const selectedIndex = visibleEvents.findIndex(
    (event) => event.id === selectedEvent?.id,
  );

  return (
    <Paper>
      <View style={styles.body}>
        <View style={styles.caption}>
          {selectedEvent && selectedIndex !== -1 ? (
            <Text
              style={[
                styles.captionText,
                { left: `${shareOf(selectedIndex) * 100}%` },
              ]}
              numberOfLines={1}
            >
              {formatYear(selectedEvent.start.year)}
            </Text>
          ) : null}
        </View>

        <View style={styles.markers}>
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
                <View
                  style={[styles.lozenge, selected && styles.lozengeSelected]}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.scale}>
          {Array.from({ length: GRADUATIONS }, (_, index) => (
            <View
              key={index}
              style={[
                styles.graduation,
                index % 2 === 0 ? styles.graduationInked : null,
              ]}
            />
          ))}
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
const CAPTION = 90;

const styles = StyleSheet.create({
  body: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8 },
  caption: { height: 15 },
  captionText: {
    position: "absolute",
    width: CAPTION,
    marginLeft: -CAPTION / 2,
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 1.2,
    color: palette.wax,
  },
  markers: { height: 18, justifyContent: "flex-end" },
  target: {
    position: "absolute",
    width: TARGET,
    marginLeft: -TARGET / 2,
    height: 18,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  lozenge: {
    width: 8,
    height: 8,
    marginBottom: 2,
    backgroundColor: palette.paperLight,
    borderWidth: 1,
    borderColor: palette.ink,
    transform: [{ rotate: "45deg" }],
  },
  lozengeSelected: {
    width: 11,
    height: 11,
    backgroundColor: palette.wax,
    borderColor: palette.waxDeep,
  },
  scale: {
    flexDirection: "row",
    height: 8,
    borderWidth: 1,
    borderColor: palette.ink,
    backgroundColor: palette.paperLight,
    overflow: "hidden",
  },
  graduation: { flex: 1 },
  graduationInked: { backgroundColor: palette.ink },
  bounds: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  bound: {
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: palette.inkFaint,
  },
  empty: {
    paddingVertical: 16,
    textAlign: "center",
    fontSize: 12,
    color: palette.inkSoft,
  },
});
