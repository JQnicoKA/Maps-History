import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

import { palette } from "../../theme/palette";
import { radius, space, TOUCH } from "../../theme/tokens";

export type InkButtonProps = {
  label: string;
  onPress: () => void;
  /** solid = the one action that matters, tonal = secondary, quiet = escape. */
  variant?: "solid" | "tonal" | "quiet";
  disabled?: boolean;
  /** Fills the row it sits in — sheet footers use this. */
  grow?: boolean;
  tone?: "ink" | "wax";
  style?: ViewStyle;
};

export function InkButton({
  label,
  onPress,
  variant = "tonal",
  disabled = false,
  grow = false,
  tone = "ink",
  style,
}: InkButtonProps) {
  const accent = tone === "wax" ? palette.wax : palette.ink;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        grow && styles.grow,
        variant === "solid" && { backgroundColor: accent },
        variant === "tonal" && styles.tonal,
        style,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === "solid" ? styles.onSolid : { color: accent },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH,
    paddingHorizontal: space.xl,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.md,
  },
  grow: { flex: 1 },
  tonal: { backgroundColor: palette.sunken },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.4 },
  label: { fontSize: 15, letterSpacing: 0.2, fontWeight: "600" },
  onSolid: { color: palette.paperLight },
});
