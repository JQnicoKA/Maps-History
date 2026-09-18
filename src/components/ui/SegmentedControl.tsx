import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";

import { palette } from "../../theme/palette";
import { radius } from "../../theme/tokens";

export type Segment<T extends string> = {
  value: T;
  label: string;
  /** Drawn before the label, tinted to match it. Optional everywhere. */
  icon?: ImageSourcePropType;
};

export type SegmentedControlProps<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * A short, mutually exclusive choice. Reads faster than a row of chips because
 * the options share one track — you see the whole scale at a glance.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track}>
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(segment.value)}
            style={({ pressed }) => [
              styles.segment,
              active && styles.active,
              pressed && !active && styles.pressed,
            ]}
          >
            {segment.icon ? (
              <Image
                source={segment.icon}
                style={[
                  styles.icon,
                  { tintColor: active ? palette.ink : palette.inkSoft },
                ]}
                resizeMode="contain"
              />
            ) : null}
            <Text
              style={[styles.label, active && styles.activeLabel]}
              numberOfLines={1}
              // Four segments on a phone leave under eighty points each; a
              // label shrinks rather than becoming "Personn…".
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: palette.sunken,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.sm + 1,
  },
  icon: { width: 16, height: 16 },
  active: { backgroundColor: palette.paperLight },
  pressed: { opacity: 0.6 },
  label: { fontSize: 13, color: palette.inkSoft, fontWeight: "500" },
  activeLabel: { color: palette.ink, fontWeight: "600" },
});
