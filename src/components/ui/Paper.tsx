import { StyleSheet, View, type ViewProps } from "react-native";

import { palette } from "../../theme/palette";

/**
 * A parchment panel with the double rule of an atlas cartouche: every surface
 * that sits over the map — bars, cards, modals — is one of these.
 */
export function Paper({ style, children, ...props }: ViewProps) {
  return (
    <View {...props} style={[styles.outer, style]}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: palette.paperLight,
    borderWidth: 1,
    borderColor: palette.ink,
    borderRadius: 2,
    padding: 3,
    shadowColor: palette.ink,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  inner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.inkFaint,
    borderRadius: 1,
  },
});
