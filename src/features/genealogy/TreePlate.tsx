import { StyleSheet, Text, View } from "react-native";

import { CARD_TOP, cellWidth, NODE } from "./layout";
import type { TreeLabel } from "../events/types";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

export type TreePlateProps = {
  label: TreeLabel;
  /** Ringed in ink: the one being worked on. */
  active?: boolean;
  dimmed?: boolean;
  pressed?: boolean;
};

/**
 * Quelques mots écrits sur l'arbre, sur une plaque de papier.
 *
 * **Du papier, là où une personne est de la cire**, et c'est le dessin qui
 * porte la distinction : une étiquette n'est pas quelqu'un, et le dire par la
 * matière évite de l'écrire. Elle n'a donc ni portrait, ni dates, ni poids —
 * « discret » et « majeur » ne veulent rien dire d'un écrit.
 *
 * Elle commence à `CARD_TOP`, c'est-à-dire **au niveau des cartes de ses
 * voisines** et non au sommet de la case. La bande du portrait reste vide
 * au-dessus d'elle, ce qui dit « personne ici » sans un mot, et les plaques de
 * noms d'une rangée gardent une seule ligne de base.
 *
 * Le serif est celui des titres : c'est la voix de l'atlas, et une étiquette
 * est un titre posé sur le dessin.
 */
export function TreePlate({
  label,
  active = false,
  dimmed = false,
  pressed = false,
}: TreePlateProps) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label.text || "Étiquette vide"}
      style={[
        styles.cell,
        { width: cellWidth(label) },
        { opacity: dimmed ? 0.25 : pressed ? 0.6 : 1 },
      ]}
    >
      <View style={[styles.plate, active && styles.plateActive]}>
        <Text style={styles.words} numberOfLines={3}>
          {label.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** La case entière, bande de portrait comprise — laissée vide. */
  cell: { height: NODE.height },
  plate: {
    position: "absolute",
    left: 0,
    right: 0,
    top: CARD_TOP,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceRaised,
    /* Une plaque posée sur la page, pas une zone de la page : le liseré la
       détache du parchemin, qui est de la même famille de couleur. */
    borderWidth: 1.5,
    borderColor: palette.border,
    ...shadow.soft,
  },
  /** Encre, comme sur une carte de personnage : c'est le même état. */
  plateActive: { borderWidth: 3, borderColor: palette.ink },
  words: {
    ...type.plate,
    fontSize: 18,
    lineHeight: 23,
    color: palette.ink,
    textAlign: "center",
  },
});
