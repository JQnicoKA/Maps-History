import { Image, Pressable, StyleSheet, View } from "react-native";

import { palette } from "../../theme/palette";
import { space } from "../../theme/tokens";

const PROFILE = require("../../../assets/icons/profile.png");

export type ProfileButtonProps = {
  /** Combien de nouvelles attendent, pour la perle. */
  unread: number;
  onPress: () => void;
};

/**
 * La porte du compte, au bord du bandeau des pages de collection.
 *
 * **Un glyphe nu, et plus un disque de cire.** Il a vécu sur la planche, où
 * il lui fallait un disque plein et une ombre dense pour tenir sur un fond
 * qui change tous les dix points. Dans un bandeau blanc il n'a rien à
 * combattre : l'encre suffit, et le disque n'y serait qu'un ornement de plus
 * à côté d'un titre.
 *
 * Il garde la perle. Une notification qu'il faut penser à aller chercher
 * n'est pas une notification — et c'est le seul endroit de l'application qui
 * l'annonce depuis que la carte n'a plus de bouton de compte.
 */
export function ProfileButton({ unread, onPress }: ProfileButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unread === 0
          ? "Votre compte"
          : `Votre compte, ${unread} notification${unread > 1 ? "s" : ""}`
      }
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.down]}
    >
      <Image source={PROFILE} style={styles.glyph} resizeMode="contain" />
      {unread > 0 ? <View style={styles.spot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: space.xs },
  /** Encre pleine : c'est un glyphe de bandeau, pas une marque de la carte. */
  glyph: { width: 24, height: 24, tintColor: palette.ink },
  down: { opacity: 0.55 },
  /**
   * La perle, cernée du fond du bandeau.
   *
   * Posée sur le bord de l'épaule du glyphe, sans cette bordure elle se
   * confondrait avec le trait qui le dessine.
   */
  spot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: palette.wax,
    borderWidth: 1.5,
    borderColor: palette.surfaceRaised,
  },
});
