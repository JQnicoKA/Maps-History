import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fetchStale, refreshFromLibrary, type Stale } from "./updates";
import type { Kind } from "./types";
import { ConfirmDialog, InkButton, useNotice } from "../../components/ui";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

export type UpdateRowProps = {
  kind: Kind;
  /** La ligne du lecteur. Null quand on est en train d'en créer une. */
  id: string | null;
  /** La reprise a eu lieu : la fiche doit se relire. */
  onRefreshed: () => void;
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
 * cette fenêtre est ce qui le respecte.
 */
export function UpdateRow({ kind, id, onRefreshed }: UpdateRowProps) {
  const [behind, setBehind] = useState<Stale | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const { say, dialog } = useNotice();

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
      {dialog}

      <ConfirmDialog
        visible={asking}
        title="Reprendre la version de la bibliothèque ?"
        /* Deux tons, pour une ligne de code. Sans modification il n'y a rien
           à perdre, et agiter un avertissement devant quelqu'un qui ne risque
           rien lui apprend à les ignorer tous. */
        message={
          behind.touched
            ? "Votre exemplaire sera entièrement réécrit : le texte, les dates, le lieu, et les photographies que vous y avez ajoutées. Ce que vous avez modifié sera perdu."
            : "Vous n'avez rien modifié sur votre exemplaire : rien ne sera perdu."
        }
        confirmLabel={busy ? "…" : "Reprendre"}
        tone={behind.touched ? "danger" : "ink"}
        cancelLabel="Annuler"
        onConfirm={() => {
          if (id === null) return;
          setBusy(true);
          void refreshFromLibrary(kind, id)
            .then(() => {
              setAsking(false);
              setBehind(null);
              onRefreshed();
            })
            .catch((cause: unknown) =>
              say(
                "Reprise impossible",
                cause instanceof Error ? cause.message : String(cause),
              ),
            )
            .finally(() => setBusy(false));
        }}
        onClose={() => setAsking(false)}
      />

      <View style={styles.said}>
        <Text style={styles.title}>Une nouvelle version existe</Text>
        <Text style={styles.detail}>
          {behind.touched
            ? "La bibliothèque a corrigé cette entrée. La reprendre écrasera vos propres modifications."
            : "La bibliothèque a corrigé cette entrée depuis que vous l'avez prise."}
        </Text>
      </View>

      <InkButton
        label="Mettre à jour"
        variant="tonal"
        onPress={() => setAsking(true)}
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
