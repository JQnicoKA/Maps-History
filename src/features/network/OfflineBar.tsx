import { StyleSheet, Text, View } from "react-native";

import { useNetwork } from "./NetworkProvider";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

/**
 * Une gélule qui dit qu'on est hors ligne, sur tous les onglets.
 *
 * **Elle flotte, comme la barre d'onglets au-dessus de laquelle elle se
 * pose.** Elle prenait sa place dans la colonne, ce qui était juste quand la
 * barre faisait de même ; la barre s'est détachée du bord, et une bande
 * ancrée coincée sous une gélule flottante aurait fait deux grammaires au
 * même endroit. Tout ce qui vit au pied de l'écran flotte désormais, et les
 * pages réservent la hauteur de l'ensemble.
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
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    /* Moins levée que la barre d'onglets : elle se pose sur elle, pas à côté
       d'elle, et deux ombres de même force au même endroit font une tache. */
    shadowColor: "#2A1F12",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: palette.wax },
  said: { ...type.caption, color: palette.inkSoft },
});
