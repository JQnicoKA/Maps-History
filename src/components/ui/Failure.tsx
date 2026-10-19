import { StyleSheet, Text, View } from "react-native";

import { InkButton } from "./InkButton";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

export type FailureProps = {
  /** Ce qui s'est passé, dans les mots du serveur ou les nôtres. */
  reason: string;
  /** Ce qu'on peut tenter. Absent quand il n'y a rien à retenter. */
  onRetry?: () => void;
  /** Une tentative est en cours : le bouton le dit et refuse d'en lancer deux. */
  retrying?: boolean;
};

/**
 * « Ça n'a pas chargé », et ce qu'on peut y faire.
 *
 * **Une façon de revenir, pas seulement une plainte.** C'était déjà
 * l'argument de la fiche qui flottait sur la carte : la collection se charge
 * une fois au lancement, donc un réseau tombé à cet instant laissait une
 * carte vide et rien à faire. Ce composant est cette fiche, sortie de la
 * carte pour que les quatre onglets la partagent.
 *
 * **Ce qu'il remplace sur les trois pages de collection est pire qu'un
 * silence.** Elles disaient « Votre collection est vide. Écrivez un
 * événement » quand la lecture avait échoué : à un lecteur dont le réseau
 * venait de tomber, elles annonçaient que son travail avait disparu.
 */
export function Failure({ reason, onRetry, retrying = false }: FailureProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.reason}>{reason}</Text>
      {onRetry === undefined ? null : (
        <InkButton
          label={retrying ? "Nouvel essai…" : "Réessayer"}
          variant="tonal"
          disabled={retrying}
          onPress={onRetry}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Lavée de rouge et cernée : c'est un refus, et il doit se lire comme tel.
   *
   * Alignée à gauche et non centrée, à la différence d'une liste vide : une
   * liste vide est un état, celle-ci est un incident, et on la lit comme une
   * phrase plutôt que comme une légende.
   */
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: palette.dangerWash,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8C9BD",
    alignItems: "flex-start",
  },
  reason: { ...type.body, color: palette.ink },
});
