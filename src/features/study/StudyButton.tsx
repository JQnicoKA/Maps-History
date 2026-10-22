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
 * En cire et sans bord, avec l'ombre dense des objets posés sur la planche :
 * c'est la matière des deux disques, arrêtée du temps du crayon et reprise
 * telle quelle — deux boutons de même office de part et d'autre d'une même
 * rangée ne peuvent pas être de deux mains différentes.
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
    backgroundColor: palette.wax,
    borderWidth: 0,
    shadowOpacity: 0.38,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 12,
  },
  /** Blanc sur la cire, large dans son disque sans le remplir. */
  glyph: { width: 26, height: 26, tintColor: palette.surfaceRaised },
});
