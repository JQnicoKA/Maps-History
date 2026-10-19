import { StyleSheet, Text, View } from "react-native";

import { useNetwork } from "./NetworkProvider";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

/**
 * Une bande qui dit qu'on est hors ligne, sur tous les onglets.
 *
 * **Elle prend sa place au lieu de recouvrir.** Posée en absolu, elle
 * cacherait la frise sur la carte ou la dernière rangée d'une liste ; en
 * frère de la barre d'onglets dans la colonne de la coquille, elle rétrécit
 * la scène de ses vingt-six points et rien ne passe dessous. C'est le bon
 * choix pour un état **durable** — ce qui recouvre est fait pour ce qui
 * passe, et être hors ligne ne passe pas.
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
    backgroundColor: palette.sunken,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: palette.wax },
  said: { ...type.caption, color: palette.inkSoft },
});
