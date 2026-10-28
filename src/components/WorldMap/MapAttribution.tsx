import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { ATTRIBUTION } from "../../config/map";
import { palette } from "../../theme/palette";

/** Le corps qu'on voudrait, et celui au-dessous duquel on ne descend pas. */
const SIZE = 9;
const SMALLEST = 7;

/** Le retrait de chaque côté — voir `container`. */
const MARGIN = 10;

/** L'interlettre, comptée dans la largeur comme elle l'est au rendu. */
const TRACKING = 0.3;

/**
 * Largeur d'un caractère, en parts du corps.
 *
 * Mesure grossière et **volontairement généreuse** : un demi-cadratin suffit
 * pour cette police, 0,55 laisse de la marge. L'erreur doit pencher de ce
 * côté-là — voir `numberOfLines` plus bas.
 */
const PER_CHAR = 0.55;

/**
 * MapTiler and OpenStreetMap both require visible credit, so this replaces the
 * native attribution ornament with something that belongs on the plate.
 *
 * **Elle se replie jusqu'à tenir sur une ligne**, et ne se tronque jamais.
 * Les quatre crédits font soixante-dix-sept caractères, ce qui déborde d'un
 * écran étroit au corps 9 et passait alors à la ligne — deux lignes de petites
 * capitales sous la frise, que rien ne justifiait.
 *
 * Le corps est **calculé** plutôt que confié à `adjustsFontSizeToFit` : celui-ci
 * mesure bien sur iOS et se comporte diversement sur Android, et deux rendus
 * différents pour une mention légale ne valent rien. Ici le calcul est le même
 * des deux côtés.
 *
 * Et le facteur est pris large exprès. `numberOfLines={1}` garantit qu'aucun
 * repli ne se produira ; si l'estimation était trop optimiste, il tronquerait
 * au lieu de replier — et une attribution tronquée n'est plus une attribution.
 * En la sous-estimant, on s'assure que la ligne tient d'elle-même et que ce
 * garde-fou ne sert jamais.
 */
export function MapAttribution({ offset = 0 }: { offset?: number }) {
  const { width } = useWindowDimensions();

  const room = width - 2 * MARGIN;
  const size = Math.max(
    SMALLEST,
    Math.min(SIZE, (room / ATTRIBUTION.length - TRACKING) / PER_CHAR),
  );

  return (
    <View
      pointerEvents="none"
      style={[styles.container, { bottom: offset + 8 }]}
    >
      <Text
        style={[styles.text, { fontSize: size }]}
        numberOfLines={1}
        /* Rien à lire à voix haute : c'est une mention de licence, et un
           lecteur d'écran qui l'épellerait avant la carte ferait obstacle à
           ce qu'on est venu voir. Elle reste visible, ce qu'exigent les
           licences. */
        accessible={false}
      >
        {ATTRIBUTION}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Bornée des deux côtés, et c'est ce qui donne sa largeur au texte.
   *
   * Elle n'avait que `right`, donc elle se dimensionnait sur son contenu : le
   * texte prenait toute la place qu'il voulait puis repliait contre le bord de
   * l'écran. Avec `left`, la ligne connaît la place dont elle dispose, et
   * `alignItems` la garde rangée à droite comme avant.
   */
  container: {
    position: "absolute",
    left: MARGIN,
    right: MARGIN,
    alignItems: "flex-end",
  },
  text: {
    letterSpacing: TRACKING,
    color: palette.inkSoft,
    opacity: 0.75,
  },
});
