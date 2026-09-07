import { Pressable, StyleSheet, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

import { palette } from "../../theme/palette";

export type GlyphButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  disabled?: boolean;
  style?: ViewStyle;
  children: ReactNode;
};

/** The parchment square every floating control on the plate is cut from. */
export function GlyphButton({
  onPress,
  accessibilityLabel,
  size = 44,
  disabled = false,
  style,
  children,
}: GlyphButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size },
        style,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
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
});
