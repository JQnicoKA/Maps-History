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
  /**
   * Un chiffre au bout de la ligne : ce que la case fait voir, compté.
   *
   * Au bout plutôt que sous le titre, parce que trois lignes alignées se
   * comparent d'un coup d'œil quand leurs chiffres sont dans la même
   * colonne, et ne se comparent plus du tout quand chacun se cache sous son
   * propre mot.
   *
   * Il n'a rien à dire quand la case est décochée : c'est à l'appelant de ne
   * pas le donner alors, la case disant déjà qu'on ne voit rien.
   */
  count?: string;
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
  count,
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
      {count === undefined || count === "" ? null : (
        <Text style={styles.count}>{count}</Text>
      )}
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
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
  },
  boxOn: { backgroundColor: palette.wax, borderColor: palette.waxDeep },
  tick: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "900",
    color: palette.surfaceRaised,
  },
  text: { flex: 1, gap: 1 },
  title: { fontSize: 16, fontWeight: "700", color: palette.ink },
  detail: { ...type.caption, color: palette.inkSoft },
  /**
   * Tabulaire, pour que la colonne de chiffres soit une colonne.
   *
   * Sans cela le « 1 » est plus étroit que le « 8 » dans la plupart des
   * fontes, et trois nombres alignés à droite se mettent à danser dès que
   * l'un d'eux change — ce qui arrive ici à chaque réglage du filtre.
   */
  count: {
    fontSize: 15,
    fontWeight: "600",
    color: palette.inkFaint,
    fontVariant: ["tabular-nums"],
  },
});
