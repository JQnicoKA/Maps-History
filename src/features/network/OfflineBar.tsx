import { StyleSheet, Text, View } from "react-native";

import { useNetwork } from "./NetworkProvider";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

/**
 * Une bande qui dit qu'on est hors ligne, sur tous les onglets.
 *
 * **Ancrée, juste au-dessus de la barre d'onglets, et prenant sa place dans
 * la colonne.** Elle a flotté le temps que la barre flotte — une gélule
 * posée sur une autre — et c'est revenu à sa forme première en même temps
 * qu'elle : une bande pleine largeur se lit comme une condition de
 * l'écran entier, ce qu'elle est, là où une gélule se lit comme un objet
 * qu'on peut toucher, ce qu'elle n'est pas.
 *
 * Qu'elle pousse le contenu de sa hauteur est juste ici : elle est rare et
 * passagère, et elle rend le peu qu'elle prend dès que le réseau revient.
 *
 * Discrète, et c'est délibéré : ce n'est pas une panne de l'application mais
 * une condition du monde, et le lecteur peut continuer de lire ce qu'il a
 * déjà. Le point de cire dit qu'il y a quelque chose à savoir ; la phrase
 * dit quoi, et qu'on s'en occupe sans lui.
 *
 * Muette tant que NetInfo n'a pas répondu : `online` vaut `null` au premier
 * rendu, et une bande qui clignote au lancement de chaque session se ferait
 * ignorer dès la troisième.
 */
export function OfflineBar() {
  const { online } = useNetwork();
  if (online !== false) return null;

  return (
    <View style={styles.bar} accessibilityRole="alert">
      <View style={styles.dot} />
      <Text style={styles.said} numberOfLines={1}>
        Hors ligne — la reprise se fera toute seule
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Un filet en haut et rien en bas : la barre d'onglets porte déjà le sien,
   * et deux traits collés auraient fait un double rail.
   */
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    backgroundColor: palette.sunken,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: palette.wax },
  said: { ...type.caption, color: palette.inkSoft },
});
