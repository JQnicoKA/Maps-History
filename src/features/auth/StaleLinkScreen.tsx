import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { InkButton } from "../../components/ui";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

/** Le même triangle que la page qui efface un compte. */
const ALERT = require("../../../assets/alerte.png");

export type StaleLinkScreenProps = {
  onClose: () => void;
};

/**
 * Ce que le lecteur voit quand son lien de réinitialisation ne vaut plus rien.
 *
 * **Cette page a remplacé un silence.** L'application s'ouvrait sur l'écran de
 * connexion, sans un mot, et le seul endroit où il était écrit que le lien
 * avait été refusé était le terminal du développeur. Le lecteur en concluait
 * ce qu'il pouvait : que l'application était cassée, ou que le courriel
 * n'était jamais arrivé.
 *
 * Deux causes mènent ici, et le lecteur n'a pas à les distinguer puisque le
 * remède est le même — voir `staleLink` dans `AuthProvider` :
 *
 *   - **Le jeton avait déjà été consommé.** Le lien de Supabase est à usage
 *     unique et se consomme au premier appel, quel qu'il soit : une ouverture
 *     précédente, un second chargement du navigateur, ou le scanner de liens
 *     d'une messagerie qui visite ce qu'on reçoit. Gmail le fait.
 *
 *   - **Le lien a été ouvert sur un autre appareil.** Un ordinateur ne porte
 *     pas le vérificateur PKCE — il est engendré et gardé par le téléphone qui
 *     a demandé le lien, et ne quitte jamais son stockage. Pire : l'ouvrir
 *     ailleurs ne se contente pas d'échouer, **ça détruit le jeton** pour le
 *     téléphone qui, lui, aurait su s'en servir.
 *
 * C'est pourquoi la phrase du milieu dit l'appareil avant de dire l'usage
 * unique : le piège qu'on tombe dedans sans le savoir est le premier.
 */
export function StaleLinkScreen({ onClose }: StaleLinkScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl },
        ]}
        alwaysBounceVertical={false}
      >
        <View style={styles.card}>
          <Image
            source={ALERT}
            style={styles.alert}
            resizeMode="contain"
            /* Décoratif : ce qu'il annonce est écrit juste dessous, et un
               lecteur d'écran qui dirait « alerte » avant de lire la phrase ne
               ferait que la redire. */
            accessible={false}
          />

          <Text style={styles.title}>Ce lien a expiré</Text>

          <Text style={styles.line}>
            Un lien de réinitialisation ne sert{" "}
            <Text style={styles.strong}>qu&apos;une seule fois</Text>, et il
            doit être ouvert{" "}
            <Text style={styles.strong}>
              sur le téléphone où l&apos;application est installée
            </Text>
            .
          </Text>

          {/* La marche à suivre **avant** le bouton, et non sous lui : c'est
              l'ordre dans lequel on en a besoin. */}
          <Text style={styles.hint}>
            Touchez « Mot de passe oublié » sur l&apos;écran de connexion pour
            en recevoir un nouveau, puis ouvrez le courriel depuis ce
            téléphone.
          </Text>

          {/* « J'ai compris » et non « Demander un nouveau lien » : ce bouton
              referme la page, il ne demande rien. Un bouton qui nomme un geste
              qu'il ne fait pas est le même défaut que le chevron d'une rangée
              qui n'ouvre rien — il promet une page qui n'existe pas.

              Et c'est aussi le seul libellé juste dans les deux cas : un
              lecteur déjà connecté qui touche un vieux lien revient à la
              carte, pas à l'écran de connexion. */}
          <InkButton label="J'ai compris" variant="solid" onPress={onClose} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.surface },
  body: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  card: {
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    ...shadow.soft,
  },
  /** Les deux dimensions nommées — voir le piège d'`Image` ailleurs. */
  alert: { width: 48, height: 48, alignSelf: "center" },
  title: { ...type.title, fontWeight: "700", color: palette.ink },
  line: { ...type.caption, color: palette.inkSoft },
  strong: { color: palette.ink, fontWeight: "700" },
  /** Sous le bouton : ce qu'on fera après l'avoir pressé. */
  hint: { ...type.caption, color: palette.inkFaint, textAlign: "center" },
});
