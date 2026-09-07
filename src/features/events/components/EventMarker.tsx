import { Image, Pressable, StyleSheet, View } from "react-native";

import { EVENT_ICONS } from "../icons";
import type { HistoricalEvent } from "../types";
import { palette } from "../../../theme/palette";

/** Where the event sits relative to the one being read. */
export type MarkerVariant = "previous" | "current" | "next";

export type EventMarkerProps = {
  event: HistoricalEvent;
  variant: MarkerVariant;
  onPress: () => void;
};

const SIZE: Record<MarkerVariant, number> = {
  previous: 50,
  current: 70,
  next: 50,
};

/**
 * A photograph in a parchment locket. The event being read is full size and
 * ringed in wax; the one before it is faded, the one after darkened — so the
 * direction of travel is legible without a legend.
 */
export function EventMarker({ event, variant, onPress }: EventMarkerProps) {
  const size = SIZE[variant];
  const photo = event.photos[0];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={event.title}
      onPress={onPress}
      style={variant === "previous" ? styles.faded : undefined}
    >
      <View
        style={[
          styles.frame,
          { width: size, height: size, borderRadius: size / 2 },
          variant === "current" ? styles.current : styles.neighbour,
        ]}
      >
        {photo === undefined ? (
          <Image
            source={EVENT_ICONS[event.type]}
            style={{ width: size * 0.56, height: size * 0.56 }}
            resizeMode="contain"
          />
        ) : (
          <Image source={{ uri: photo.url }} style={styles.photo} />
        )}

        {variant === "next" ? <View style={styles.shade} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: palette.paperLight,
    shadowColor: palette.ink,
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  current: { borderWidth: 3, borderColor: palette.wax },
  neighbour: { borderWidth: 2, borderColor: palette.ink },
  faded: { opacity: 0.45 },
  photo: { width: "100%", height: "100%" },
  shade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.ink,
    opacity: 0.4,
  },
});
