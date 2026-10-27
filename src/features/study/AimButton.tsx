import { Pressable, StyleSheet, Text, View } from "react-native";

import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

/** Le filet du bouton, et la pastille qu'il faut contrebalancer. */
const BORDER = 1.5;
const BEAD = 18;

export type AimButtonProps = {
  label: string;
  /** Une ligne qui dit ce qu'on va réviser, et combien il y en a. */
  detail?: string;
  chosen: boolean;
  /**
   * Grisé parce qu'il ne se cumule pas avec ce qui est déjà choisi.
   *
   * Il reste lisible et il reste pressable : presser un but exclusif range
   * les autres au lieu de ne rien faire. Un bouton qui ne répond pas se lit
   * comme un bouton cassé.
   */
  dimmed?: boolean;
  /**
   * Le mot d'un cran plus grand, et la boîte avec.
   *
   * Pour les trois buts d'une étude, qui annoncent une matière — les quatre
   * parties du monde, au pas suivant, sont une liste de choix et gardent la
   * taille des listes de l'application.
   *
   * **Et c'est tout ce qu'il reste d'un drapeau qui fut `dark`.** Les trois
   * buts ont porté chacun une scène dessinée, puis un aplat noir qui l'a
   * remplacée — avec un filet pâle, une pastille creuse et un choix dit par
   * le clair, le brun du « Suivant » étant invisible sur du noir. Les voilà
   * sur le papier de la carte comme tout le reste du panneau, et ces quatre
   * styles n'ont plus rien à contourner : un seul jeu de couleurs sert les
   * deux pas, et il n'y a plus qu'une façon de dire « c'est pris ».
   */
  big?: boolean;
  onPress: () => void;
};

/**
 * Un des choix d'une étude, en pleine largeur.
 *
 * Empilés plutôt que rangés côte à côte : ce sont des matières à réviser et
 * non des réglages d'une même chose, et en colonne chacune a la place de dire
 * ce qu'elle contient.
 *
 * Le choix se marque par le bord et par la pastille, jamais par une case à
 * cocher — une case dirait « plusieurs possibles », ce qui n'est vrai que de
 * deux des trois buts.
 */
export function AimButton({
  label,
  detail,
  chosen,
  dimmed = false,
  big = false,
  onPress,
}: AimButtonProps) {
  /**
   * Un mot seul se pose au milieu.
   *
   * Une ligne de titre suivie d'une ligne de détail fait un bloc, et un bloc
   * s'aligne à gauche pour que ses deux lignes commencent au même endroit. Un
   * mot seul n'a pas de second départ à tenir.
   */
  const middle = detail === undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: chosen }}
      accessibilityLabel={detail === undefined ? label : `${label} — ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        big ? styles.tall : null,
        chosen ? styles.chosen : null,
        dimmed && !chosen ? styles.dimmed : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {/* Le contrepoids de la pastille.
          Sans lui, le mot se centrerait dans la place qu'elle lui laisse,
          c'est-à-dire treize points trop à gauche — assez pour que trois
          boutons empilés paraissent de travers. */}
      {middle ? <View style={styles.counterweight} /> : null}

      <View style={[styles.words, middle ? styles.wordsMiddle : null]}>
        <Text style={[styles.label, big ? styles.labelBig : null]}>
          {label}
        </Text>
        {detail === undefined ? null : (
          <Text style={styles.detail}>{detail}</Text>
        )}
      </View>

      {/* La pastille de choix, à droite : pleine quand c'est pris, creuse
          sinon. Elle suit le bord plutôt que de le doubler — sur des lignes
          de même hauteur, l'œil cherche une marque à une place fixe. */}
      <View style={[styles.bead, chosen ? styles.beadOn : null]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 62,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceRaised,
    borderWidth: BORDER,
    borderColor: palette.line,
    overflow: "hidden",
    ...shadow.soft,
  },
  /**
   * Plus haut, parce que le mot y est plus grand.
   *
   * Soixante-seize points : un titre de vingt et un points dans une boîte de
   * soixante-deux touche presque ses bords. Rien de plus — la couleur est
   * celle de tous les boutons du panneau.
   */
  tall: { minHeight: 76 },
  /**
   * C'est pris, et dans l'encre du bouton « Suivant ».
   *
   * Le même brun que ce qu'on va presser ensuite : ce qu'on choisit et ce qui
   * emmène plus loin sont d'une seule couleur.
   */
  chosen: {
    borderColor: palette.ink,
    backgroundColor: palette.paperDeep,
  },
  /**
   * Rangé, mais pas éteint.
   *
   * Les territoires ne se cumulent avec rien : quand ils sont choisis, les
   * deux autres pâlissent pour le dire. Ils restent pressables — presser
   * l'un d'eux range les territoires, ce qui est la façon la plus courte de
   * changer d'avis.
   */
  dimmed: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  words: { flex: 1, gap: 2 },
  wordsMiddle: { alignItems: "center" },
  /** Exactement la pastille, de l'autre côté — voir `BEAD`. */
  counterweight: { width: BEAD },
  label: { ...type.heading, fontWeight: "700", color: palette.ink },
  detail: { ...type.caption, color: palette.inkSoft },
  /** D'un cran plus grand, et seulement sur les buts — voir `big`. */
  labelBig: { fontSize: type.title.fontSize },
  bead: {
    width: BEAD,
    height: BEAD,
    borderRadius: radius.pill,
    borderWidth: BORDER,
    borderColor: palette.line,
    backgroundColor: palette.surfaceRaised,
  },
  beadOn: { backgroundColor: palette.ink, borderColor: palette.ink },
});
