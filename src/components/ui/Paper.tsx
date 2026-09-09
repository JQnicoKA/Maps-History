import { StyleSheet, View, type ViewProps } from "react-native";

import { palette } from "../../theme/palette";
import { radius, shadow } from "../../theme/tokens";

/**
 * A surface resting on the plate. The double engraved rule it used to carry has
 * given way to a single hairline and soft elevation — the map stays antique,
 * the chrome over it reads as a current app.
 */
export function Paper({ style, children, ...props }: ViewProps) {
  return (
    <View {...props} style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.paperLight,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    ...shadow.soft,
  },
});
