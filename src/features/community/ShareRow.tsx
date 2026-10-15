import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { TickRow, useNotice } from "../../components/ui";
import { palette } from "../../theme/palette";
import { radius, space } from "../../theme/tokens";

export type ShareRowProps = {
  /** What this is, said in the line: "cet événement", "ce personnage"… */
  what: string;
  /**
   * Ce que l'autorisation permet, quand ce n'est pas l'ordinaire.
   *
   * Par défaut : la bibliothèque s'inspire de la chose pour écrire ses
   * propres entrées, et rien n'est publié tel quel. **Une ville et un
   * territoire ne marchent pas comme ça** — vérifiés, ils sont promus dans le
   * fond de carte tels quels, donc leur dire la phrase par défaut serait leur
   * mentir. Voir `promote_place`.
   */
  means?: string;
  shared: boolean;
  onChange: (shared: boolean) => Promise<void>;
};

/**
 * Ce que la bibliothèque a le droit de faire de ceci.
 *
 * **La case ne partage plus rien.** Elle le faisait : cocher mettait la chose
 * dans le catalogue, où chacun pouvait la lire et la copier — d'où la jungle
 * de doublons que ce virage défait. Désormais le catalogue ne montre que la
 * bibliothèque, qui est relue et composée par une seule main, et ce que
 * cette case accorde est tout autre : **l'autorisation de s'en inspirer.**
 *
 * Cochée par défaut, partout, et c'est la posture de l'application : ce qu'on
 * écrit ici est de l'histoire et non un journal intime. L'effort est demandé
 * à qui ne veut pas y contribuer, pas à qui le veut bien. Décochez-la et la
 * chose n'est plus regardée du tout.
 *
 * Put at the foot of a card rather than in the middle of a form: it is not a
 * field to fill in, it is a thing that is already true and can be undone.
 *
 * **The line under the title says what ticking the box does, and says it the
 * same whether the box is ticked or not.** It read the current state before —
 * "les autres peuvent le lire" against "n'appartient qu'à vous" — and a line
 * that rewrites itself under the hand that just moved the tick asks the reader
 * to work out which of the two states they are now in, from prose, when the
 * tick beside it already answers that. One sentence, and the tick carries the
 * state alone.
 *
 * **Il n'y a plus de cas verrouillé.** Une copie portait la case grisée et une
 * raison à la place de la phrase : « une copie reste chez vous, la
 * bibliothèque a déjà l'entrée dont elle vient ». C'était vrai du temps où la
 * case voulait dire *publier*. Elle veut dire « s'en inspirer », et une copie
 * qu'on améliore est exactement ce dont l'entrée d'origine gagnerait à
 * profiter. Le choix est donc offert partout.
 */
export function ShareRow({ what, means, shared, onChange }: ShareRowProps) {
  const [busy, setBusy] = useState(false);
  const { say, dialog } = useNotice();

  return (
    <View style={styles.frame}>
      {dialog}
      <TickRow
        title="Ouvert à la bibliothèque"
        detail={
          means ??
          `Autorise la bibliothèque à s'inspirer de ${what}`
        }
        on={shared}
        disabled={busy}
        onToggle={() => {
          setBusy(true);
          void onChange(!shared)
            .catch((cause: unknown) =>
              say(
                "Changement impossible",
                cause instanceof Error ? cause.message : String(cause),
              ),
            )
            .finally(() => setBusy(false));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** Set apart: what follows is about everybody else, not about this card. */
  frame: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
});
