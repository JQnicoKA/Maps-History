import { Pressable, StyleSheet, Text, View } from "react-native";

import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

export type TickRowProps = {
  title: string;
  /**
   * The line under the title, in as few words as it takes.
   *
   * Either a live readout — the filters count what each layer is showing —
   * or a fixed description of what ticking the box does, which is what the
   * sharing row gives. Both are legitimate; what is not is a *description*
   * that rewrites itself with the state, since the tick says that already.
   */
  detail?: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

/**
 * A box someone ticks, and what ticking it means.
 *
 * Drawn square and thick-edged rather than borrowed from the system: a switch
 * out of the settings app on a hand-coloured plate reads as somebody else's
 * furniture. The same control answers the two questions the app asks this way
 * — what the map is carrying, and what the community may see — so the gesture
 * is learnt once.
 */
export function TickRow({
  title,
  detail,
  on,
  onToggle,
  disabled = false,
}: TickRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <View style={[styles.box, on && styles.boxOn]}>
        {on ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {detail === undefined || detail === "" ? null : (
          <Text style={styles.detail}>{detail}</Text>
        )}
      </View>
    </Pressable>
  );
}

/** The tick's own width, so callers can indent what it governs. */
export const TICK = 24;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  pressed: { opacity: 0.6 },
  box: {
    width: TICK,
    height: TICK,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: palette.paperDeep,
    backgroundColor: palette.paperLight,
  },
  boxOn: { backgroundColor: palette.wax, borderColor: palette.waxDeep },
  tick: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "900",
    color: palette.paperLight,
  },
  text: { flex: 1, gap: 1 },
  title: { fontSize: 16, fontWeight: "700", color: palette.ink },
  detail: { ...type.legend, color: palette.inkSoft },
});
