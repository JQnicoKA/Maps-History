import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fetchStale, type Stale } from "./updates";
import type { Kind } from "./types";
import { InkButton } from "../../components/ui";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

export type UpdateRowProps = {
  kind: Kind;
  /** La ligne du lecteur. Null quand on est en train d'en créer une. */
  id: string | null;
  /**
   * Demande la fiche de l'entrée corrigée, dans le catalogue.
   *
   * C'est là que la reprise se fait maintenant. Ce bouton ne reprenait rien
   * sans un oui, mais ce oui était demandé **à l'aveugle** : « votre
   * exemplaire sera entièrement réécrit » sans montrer par quoi. On va donc
   * lire la version de la bibliothèque, et c'est sa fiche qui porte le geste.
   */
  onSee: (entry: string) => void;
};

/**
 * « La bibliothèque a corrigé cette entrée depuis que vous l'avez prise. »
 *
 * **Absente quand il n'y a rien à reprendre**, et c'est la moitié de son
 * intérêt. Un bouton permanent qui répond « vous êtes déjà à jour » est pire
 * que pas de bouton : il demande qu'on aille vérifier, et apprend à ne plus
 * vérifier.
 *
 * Elle interroge elle-même plutôt que de recevoir sa réponse d'un
 * fournisseur. `stale()` ne rend que ce qui est en retard — donc presque
 * toujours rien — et le coût d'une question à l'ouverture d'un formulaire est
 * inférieur à celui d'un état de plus à tenir à jour dans toute
 * l'application.
 *
 * Rien n'est repris sans un oui. La carte de quelqu'un ne doit pas bouger
 * pendant la nuit : c'était l'argument contre la propagation automatique, et
 * il tient toujours — le oui se demande simplement une page plus loin,
 * devant le texte qu'on va recevoir.
 */
export function UpdateRow({ kind, id, onSee }: UpdateRowProps) {
  const [behind, setBehind] = useState<Stale | null>(null);

  const look = useCallback(() => {
    if (id === null) return;
    let alive = true;
    void fetchStale()
      .then((all) => {
        if (!alive) return;
        setBehind(
          all.find((one) => one.kind === kind && one.id === id) ?? null,
        );
      })
      // Muet : personne n'a demandé cette question, et y répondre « le
      // réseau a refusé » au-dessus d'un formulaire serait du bruit.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [kind, id]);

  useEffect(() => look(), [look]);

  if (behind === null) return null;

  return (
    <View style={styles.frame}>
      <View style={styles.said}>
        <Text style={styles.title}>Une nouvelle version existe</Text>
        <Text style={styles.detail}>
          {behind.touched
            ? "La bibliothèque a corrigé cette entrée. La reprendre écrasera vos propres modifications."
            : "La bibliothèque a corrigé cette entrée depuis que vous l'avez prise."}
        </Text>
      </View>

      <InkButton
        label="Voir"
        variant="tonal"
        onPress={() => onSee(behind.entry)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  said: { gap: 2 },
  title: { ...type.legend, color: palette.ink },
  detail: { ...type.caption, color: palette.inkSoft },
});
