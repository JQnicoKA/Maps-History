import { Pressable, StyleSheet, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

import { palette } from "../../theme/palette";
import { radius, TOUCH } from "../../theme/tokens";

export type GlyphButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  disabled?: boolean;
  style?: ViewStyle;
  children: ReactNode;
};

/**
 * The parchment disc every floating control on the plate is cut from.
 *
 * One colour, and it stands off the map by its shadow alone. A highlight
 * across the top was tried and thrown away: any gradient strong enough to
 * read as light reads first as a second colour, and the button looks like two
 * halves with a seam. What makes a disc lift is the dark under it, not the
 * light on it.
 */
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
    borderRadius: radius.pill,
    /**
     * A drawn edge, not a hairline.
     *
     * A hairline is a rendering artefact — it thins with the screen's density
     * and vanishes against a coastline. At a point and a half in the paper's
     * own deeper tone it reads as the cut edge of a disc punched out of the
     * sheet, which is what gives the button a thickness the shadow alone
     * could only suggest.
     */
    borderWidth: 1.5,
    borderColor: palette.paperDeep,
    /**
     * Deeper and softer than the app's `shadow.soft`, and cast further down.
     *
     * These sit on a busy, mid-toned map rather than on a plain surface, so
     * the shadow has to do all the separating on its own — a hairline is
     * invisible against a coastline.
     */
    shadowColor: "#2A1F12",
    shadowOpacity: 0.26,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  /** Pressed, it settles onto the plate: the shadow all but disappears. */
  pressed: {
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    opacity: 0.85,
  },
  disabled: { opacity: 0.3 },
});
