import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";

import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

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
   * L'image de fond, quand il y en aura une.
   *
   * Les trois buts en recevront une chacun. En attendant, le papier et le
   * bord suffisent à les distinguer, et le jour où les images arrivent c'est
   * cette seule propriété qui change.
   */
  background?: ImageSourcePropType;
  onPress: () => void;
};

/**
 * Un des trois buts d'une étude, en pleine largeur.
 *
 * Empilés plutôt que rangés côte à côte : ce sont trois matières à réviser et
 * non trois réglages d'une même chose, et en colonne chacune a la place de
 * dire ce qu'elle contient.
 *
 * Le choix se marque par le bord et par le papier — deux points de cire et un
 * fond plus chaud — et non par une case à cocher. Une case dirait « plusieurs
 * possibles », ce qui n'est vrai que de deux des trois.
 */
export function AimButton({
  label,
  detail,
  chosen,
  dimmed = false,
  background,
  onPress,
}: AimButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: chosen }}
      accessibilityLabel={detail === undefined ? label : `${label} — ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        chosen ? styles.chosen : null,
        dimmed && !chosen ? styles.dimmed : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {background === undefined ? null : (
        <Image
          source={background}
          style={styles.backdrop}
          resizeMode="cover"
          accessible={false}
        />
      )}
      <View style={styles.words}>
        <Text style={styles.label}>{label}</Text>
        {detail === undefined ? null : (
          <Text style={styles.detail}>{detail}</Text>
        )}
      </View>
      {/* La pastille de choix, à droite : un disque plein quand c'est pris,
          un anneau vide sinon. Elle suit le bord plutôt que de le doubler —
          sur trois lignes de même hauteur, l'œil cherche une marque à une
          place fixe. */}
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
    borderWidth: 1.5,
    borderColor: palette.line,
    overflow: "hidden",
    ...shadow.soft,
  },
  /** Deux points de cire et un papier plus chaud : c'est pris. */
  chosen: {
    borderColor: palette.wax,
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
  backdrop: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  words: { flex: 1, gap: 2 },
  label: { ...type.heading, fontWeight: "700", color: palette.ink },
  detail: { ...type.caption, color: palette.inkSoft },
  bead: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surfaceRaised,
  },
  beadOn: { backgroundColor: palette.wax, borderColor: palette.waxDeep },
});
