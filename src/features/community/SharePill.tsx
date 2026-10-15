import { Image, StyleSheet, View } from "react-native";

import { palette } from "../../theme/palette";
import { radius, space } from "../../theme/tokens";

const EYE = require("../../../assets/icons/eye.png");
const EYE_OFF = require("../../../assets/icons/eye-off.png");

export type SharePillProps = {
  shared: boolean;
  /**
   * Plus discrète, pour une pastille qui tient seule sur sa ligne.
   *
   * La taille normale est accordée à la pastille de type d'un événement, à
   * côté de laquelle elle se pose : deux faits sur une ligne, et l'une plus
   * haute que l'autre se lirait comme une erreur. Seule, elle n'a personne
   * à égaler et peut se faire oublier.
   */
  small?: boolean;
};

/**
 * Les deux tailles de l'œil, à la proportion de son dessin.
 *
 * Son cadre fait 48 sur 28 — voir `assets/icons/src/eye.svg` — donc la hauteur
 * suit la largeur, sans quoi `resizeMode="contain"` laisserait du vide en haut
 * et en bas et la pastille grandirait pour rien.
 *
 * `line` est la hauteur qu'occupait le mot qu'il remplace. L'œil se centre
 * dedans, donc la pastille garde exactement la hauteur qu'elle avait.
 */
const NORMAL = { line: 16, width: 22 } as const;
const SMALL = { line: 13, width: 18 } as const;
const RATIO = 28 / 48;

/**
 * Whether this is in the community, said at the top of a card.
 *
 * It replaced a ticked line at the foot of the detail sheet, and the move is
 * the point: down there it was a *control*, the last thing on the page, read
 * after everything else and offering a change nobody came to make. What a
 * reader actually wants from it is a fact — is this mine alone, or is it out
 * there — and a fact belongs at the top, beside the other two (what kind of
 * thing, and when). The change itself lives in the form, with the rest of
 * what can be edited.
 *
 * The two faces are deliberately unalike rather than one pill in two colours.
 * Shared is a stamp: filled wax, the colour this app uses for "something
 * happened here", and an open eye on it. Private is its absence: an outline,
 * no fill, quiet ink, the eye struck through — nothing was stamped. A reader
 * can tell them apart at a glance, which two tints of the same shape never
 * manage.
 *
 * Elle portait un mot — « Partagé », « Privé » — et l'œil le remplace : ce
 * qu'elle dit est une question de regard, et un dessin le dit dans n'importe
 * quelle langue et dans la moitié de la place. Le mot survit dans
 * `accessibilityLabel`, parce qu'un lecteur d'écran ne voit pas d'œil.
 */
export function SharePill({ shared, small = false }: SharePillProps) {
  const size = small ? SMALL : NORMAL;
  return (
    <View
      accessible
      accessibilityLabel={shared ? "Partagé" : "Privé"}
      style={[
        styles.pill,
        small && styles.smaller,
        shared ? styles.stamped : styles.outlined,
      ]}
    >
      <View style={[styles.box, { height: size.line }]}>
        <Image
          source={shared ? EYE : EYE_OFF}
          resizeMode="contain"
          // Teinté plutôt que décliné en deux fichiers : le glyphe est tracé
          // en encre dans sa source, et doit se lire crème sur le cachet de
          // cire comme en encre pâle sur le papier nu. C'est ce que fait déjà
          // la barre d'onglets avec les siens.
          style={{
            width: size.width,
            height: size.width * RATIO,
            tintColor: shared ? palette.paperLight : palette.inkFaint,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The same height and bite as the type badge beside it: they are two facts
  // on one line, and a pill a few pixels taller than its neighbour reads as a
  // mistake rather than as emphasis.
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  smaller: { paddingHorizontal: space.xs, paddingVertical: 2 },
  stamped: { backgroundColor: palette.wax, borderColor: palette.waxDeep },
  outlined: { backgroundColor: "transparent", borderColor: palette.line },
  box: { alignItems: "center", justifyContent: "center" },
});
