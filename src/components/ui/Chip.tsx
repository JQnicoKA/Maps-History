import { Pressable, StyleSheet, Text, View } from "react-native";

import { palette } from "../../theme/palette";
import { radius, space } from "../../theme/tokens";

export type ChipProps = {
  label: string;
  selected?: boolean;
  /**
   * De quelle couleur il se remplit quand il est pris.
   *
   * `"ink"` par défaut, le ton neutre des choix — une largeur d'étiquette, un
   * tri du catalogue, une portée sur la carte. `"wax"` pour les classeurs, et
   * la raison est que ce sont des **sujets** : la cire est la couleur dont
   * cette application marque ce que le lecteur a sous les yeux, et un sujet
   * sous lequel il range son histoire en est un.
   *
   * Un ton et non pas un remplacement du neutre : la pastille sert aussi là
   * où la cire voudrait dire autre chose qu'elle ne dit.
   */
  tone?: "ink" | "wax";
  /**
   * Absent where the pastille only states something.
   *
   * A reader's own classeurs, printed on the card of an event one is reading,
   * are not a choice — there is nothing to toggle there. Drawn by this
   * component all the same, and not by a second stylesheet beside it: that is
   * how the lens ended up in two pieces once, one copy having drifted five
   * points from the other.
   */
  onPress?: () => void;
};

export function Chip({
  label,
  selected = false,
  tone = "ink",
  onPress,
}: ChipProps) {
  const filled = selected && (tone === "wax" ? styles.onWax : styles.onInk);
  const body = (
    <Text style={[styles.label, selected && styles.filledLabel]}>{label}</Text>
  );

  if (onPress === undefined) {
    return <View style={[styles.chip, filled]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, filled, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: space.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: palette.sunken,
  },
  onInk: { backgroundColor: palette.ink },
  onWax: { backgroundColor: palette.wax },
  pressed: { opacity: 0.65 },
  label: { fontSize: 14, color: palette.inkSoft, fontWeight: "500" },
  /** Le crème des deux fonds pleins : la cire et l'encre le portent aussi bien. */
  filledLabel: { color: palette.paperLight },
});
