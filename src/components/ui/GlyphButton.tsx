import { Pressable, StyleSheet, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

import { palette } from "../../theme/palette";
import { radius, shadow, TOUCH } from "../../theme/tokens";

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
  size = TOUCH,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    borderRadius: radius.pill,
    ...shadow.soft,
  },
  pressed: { opacity: 0.55 },
  disabled: { opacity: 0.3 },
});
