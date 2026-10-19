import { Image, StyleSheet, View } from "react-native";

import { GlyphButton } from "../../components/ui";
import { useNotices } from "../../features/community/NoticeList";
import { palette } from "../../theme/palette";

const PROFILE = require("../../../assets/icons/profile.png");

export type AccountButtonProps = {
  /** Demande la page du compte. */
  onPress: () => void;
};

/**
 * Le disque du profil, sur la planche.
 *
 * **Il ne porte plus que le geste.** Il tenait aussi la carte « Votre
 * compte » et ses cinq faces, six cents lignes durant, parce que la carte
 * était la seule chose qui en sortait. Le compte est devenu une page levée
 * par-dessus l'application — voir `AccountScreen` — et ce disque est redevenu
 * ce qu'il paraît être : un bouton.
 *
 * Il garde la perle, et c'est délibéré : une notification qu'il faut penser à
 * aller chercher n'est pas une notification. Il relit donc le compte des
 * nouvelles, ce que la page fait aussi de son côté — deux lectures d'un même
 * cache, pas deux requêtes.
 */
export function AccountButton({ onPress }: AccountButtonProps) {
  const { notices } = useNotices();

  return (
    <GlyphButton
      accessibilityLabel={
        notices.length === 0
          ? "Votre compte"
          : `Votre compte, ${notices.length} notification${notices.length > 1 ? "s" : ""}`
      }
      onPress={onPress}
    >
      <Image source={PROFILE} style={styles.glyph} resizeMode="contain" />
      {/* Le point sur le disque lui-même, et pas seulement dans la page :
          cire à cacheter plutôt que rouge d'alerte — elle signale ce qui
          attend un regard, pas ce qui a mal tourné. */}
      {notices.length > 0 ? <View style={styles.spot} /> : null}
    </GlyphButton>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 22, height: 22 },
  /**
   * Le point sur le disque du compte.
   *
   * Bordé de la couleur du disque : posé sur le bord du cercle, sans cette
   * bordure il se confond avec le trait qui le dessine.
   */
  spot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.wax,
    borderWidth: 1.5,
    borderColor: palette.surfaceRaised,
  },
});
