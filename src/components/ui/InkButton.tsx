import { Pressable, StyleSheet, Text } from "react-native";

import { palette } from "../../theme/palette";

export type InkButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "solid" | "outline" | "quiet";
  disabled?: boolean;
};

export function InkButton({
  label,
  onPress,
  variant = "outline",
  disabled = false,
}: InkButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "solid" && styles.solid,
        variant === "quiet" && styles.quiet,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, variant === "solid" && styles.solidLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: palette.ink,
    borderRadius: 2,
    backgroundColor: "transparent",
    alignItems: "center",
  },
  solid: { backgroundColor: palette.ink },
  quiet: { borderColor: "transparent" },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },
  label: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: palette.ink,
  },
  solidLabel: { color: palette.paperLight },
});
