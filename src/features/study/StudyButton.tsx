import { useState } from "react";
import { Image, StyleSheet } from "react-native";

import { StudySetupDialog } from "./StudySetupDialog";
import type { StudySetup } from "./subjects";
import { GlyphButton } from "../../components/ui";
import { palette } from "../../theme/palette";

const STUDY = require("../../../assets/icons/study.png");

/** La taille des disques de la planche — celle du crayon, en face. */
const DISC = 58;

export type StudyButtonProps = {
  onStart: (setup: StudySetup) => void;
};

/**
 * Le mortier, au coin haut gauche de la planche.
 *
 * Il fait pendant au crayon, à l'autre bout de la même rangée, et c'est voulu :
 * ce sont les deux seuls verbes de la carte — dessiner dessus, se faire
 * interroger dessus. Entre eux, la pastille des filtres, qui ne fait rien mais
 * dit ce qu'on regarde.
 *
 * **Deux verbes, deux couleurs**, et ils se distinguent : la cire pour le
 * crayon, l'encre pour le mortier. Elle fut un brun de reliure, `#543B27`,
 * puis noire avec tous les aplats de l'application. La forme, l'ombre et le
 * glyphe blanc restent ceux du crayon : ce qui les rapproche est ce qu'ils
 * sont — deux disques posés sur la planche —, ce qui les sépare est ce
 * qu'ils font.
 *
 * Le glyphe blanc pèse 21:1 sur le noir, contre 7,6 sur la cire.
 */
export function StudyButton({ onStart }: StudyButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <GlyphButton
        accessibilityLabel="Étudier"
        size={DISC}
        style={styles.disc}
        onPress={() => setOpen(true)}
      >
        <Image source={STUDY} style={styles.glyph} resizeMode="contain" />
      </GlyphButton>

      <StudySetupDialog
        visible={open}
        onClose={() => setOpen(false)}
        onStart={onStart}
      />
    </>
  );
}

const styles = StyleSheet.create({
  disc: {
    backgroundColor: palette.ink,
    borderWidth: 0,
    shadowOpacity: 0.38,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 12,
  },
  /**
   * Blanc sur la reliure, et plus large que celui du crayon.
   *
   * Trente-quatre points et non vingt-six, parce que les deux dessins ne
   * remplissent pas leur carré de la même façon : le crayon traverse le sien
   * en diagonale d'un coin à l'autre, le mortier est une forme large et
   * plate qui n'occupe que la moitié de sa hauteur. À taille égale, il
   * paraissait donc deux fois plus petit. Son encre atteint vingt-cinq points
   * de large pour douze de haut — il reste seize points de reliure de chaque
   * côté, et le disque se lit toujours comme un disque.
   */
  glyph: { width: 34, height: 34, tintColor: palette.surfaceRaised },
});
