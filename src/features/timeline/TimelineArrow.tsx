import { Pressable, StyleSheet, Text } from "react-native";

import { useEvents } from "../events/EventsProvider";
import { palette } from "../../theme/palette";

export type TimelineArrowProps = {
  direction: "previous" | "next";
};

/** Steps the selection along the timeline. Sits outside the frieze, flanking it. */
export function TimelineArrow({ direction }: TimelineArrowProps) {
  const { visibleEvents, selectedEvent, step } = useEvents();

  const edge =
    direction === "previous"
      ? visibleEvents[0]
      : visibleEvents[visibleEvents.length - 1];
  const disabled = visibleEvents.length === 0 || edge?.id === selectedEvent?.id;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        direction === "previous" ? "Événement précédent" : "Événement suivant"
      }
      disabled={disabled}
      onPress={() => step(direction === "previous" ? -1 : 1)}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.glyph}>
        {direction === "previous" ? "‹" : "›"}
      </Text>
    </Pressable>
  );
}

const SIZE = 40;

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperLight,
    borderWidth: 1,
    borderColor: palette.ink,
    borderRadius: 2,
    shadowColor: palette.ink,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pressed: { opacity: 0.55 },
  disabled: { opacity: 0.3 },
  glyph: { fontSize: 24, lineHeight: 28, color: palette.ink },
});
