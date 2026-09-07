import { Pressable, StyleSheet, Text, View } from "react-native";

import { Paper } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { formatYear, toSortKey } from "../events/historicalDate";
import { palette } from "../../theme/palette";

function Arrow({
  direction,
  disabled,
  onPress,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        direction === "previous" ? "Événement précédent" : "Événement suivant"
      }
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrow,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.arrowGlyph}>
        {direction === "previous" ? "‹" : "›"}
      </Text>
    </Pressable>
  );
}

/**
 * The chronological span of whatever the filters currently select, with one
 * tick per event. Positions are a share of the span, so the track needs no
 * measurement to lay itself out.
 */
export function Timeline() {
  const { visibleEvents, selectedEvent, selectEvent, step } = useEvents();

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

  return (
    <Paper>
      <View style={styles.body}>
        <Arrow
          direction="previous"
          disabled={visibleEvents[0]?.id === selectedEvent?.id}
          onPress={() => step(-1)}
        />

        <View style={styles.track}>
          <View style={styles.rule} />
          {visibleEvents.map((event, index) => {
            const share = span === 0 ? 0.5 : (keys[index]! - first) / span;
            const selected = event.id === selectedEvent?.id;
            return (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={event.title}
                onPress={() => selectEvent(event.id)}
                style={[styles.tickTarget, { left: `${share * 100}%` }]}
              >
                <View style={[styles.tick, selected && styles.tickSelected]} />
              </Pressable>
            );
          })}
          <Text style={[styles.bound, styles.boundStart]}>
            {formatYear(visibleEvents[0]!.start.year)}
          </Text>
          <Text style={[styles.bound, styles.boundEnd]}>
            {formatYear(visibleEvents[visibleEvents.length - 1]!.start.year)}
          </Text>
        </View>

        <Arrow
          direction="next"
          disabled={
            visibleEvents[visibleEvents.length - 1]?.id === selectedEvent?.id
          }
          onPress={() => step(1)}
        />
      </View>
    </Paper>
  );
}

const TICK_TARGET = 24;

const styles = StyleSheet.create({
  body: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  arrow: { paddingHorizontal: 10, paddingVertical: 2 },
  arrowGlyph: { fontSize: 26, lineHeight: 30, color: palette.ink },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.25 },
  track: { flex: 1, height: 44, justifyContent: "center" },
  rule: { height: 1, backgroundColor: palette.inkFaint },
  tickTarget: {
    position: "absolute",
    width: TICK_TARGET,
    marginLeft: -TICK_TARGET / 2,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  tick: { width: 1.5, height: 13, backgroundColor: palette.inkSoft },
  tickSelected: { width: 3, height: 22, backgroundColor: palette.wax },
  bound: {
    position: "absolute",
    bottom: -2,
    fontSize: 9,
    letterSpacing: 0.6,
    color: palette.inkFaint,
  },
  boundStart: { left: 0 },
  boundEnd: { right: 0 },
  empty: {
    paddingVertical: 14,
    textAlign: "center",
    fontSize: 12,
    color: palette.inkSoft,
  },
});
