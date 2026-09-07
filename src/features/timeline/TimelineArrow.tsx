import { StyleSheet, Text } from "react-native";

import { GlyphButton } from "../../components/ui";
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
    <GlyphButton
      accessibilityLabel={
        direction === "previous" ? "Événement précédent" : "Événement suivant"
      }
      size={40}
      disabled={disabled}
      onPress={() => step(direction === "previous" ? -1 : 1)}
    >
      <Text style={styles.glyph}>{direction === "previous" ? "‹" : "›"}</Text>
    </GlyphButton>
  );
}

const styles = StyleSheet.create({
  glyph: { fontSize: 24, lineHeight: 28, color: palette.ink },
});
