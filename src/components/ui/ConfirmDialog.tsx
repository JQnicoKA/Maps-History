import { StyleSheet, View } from "react-native";

import { Dialog } from "./Dialog";
import { InkButton } from "./InkButton";
import { space } from "../../theme/tokens";

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  /** What is at stake, in a line or two. */
  message?: string;
  /** The word on the button: "Supprimer", "Retirer", "Copier l'événement"… */
  confirmLabel: string;
  /**
   * Red by default, because this card was built for losing things.
   *
   * `"ink"` for a decision that takes nothing away — taking a copy, say.
   * Painting it red there would warn against the very thing the reader came
   * to do.
   */
  tone?: "ink" | "danger";
  /**
   * A second way out, named.
   *
   * Absent by default: in front of a deletion, "Annuler" and the cross do
   * exactly the same thing, and one of them is furniture. But a question that
   * is **not** a warning reads better with its two answers side by side —
   * "Annuler" and "Copier l'arbre" — than with one button and a cross in
   * the corner.
   */
  cancelLabel?: string | null;
  /**
   * Transmis à `Dialog` — voir sa propre documentation.
   *
   * `"soft"` quand cette confirmation s'ouvre depuis une feuille, ce qui est
   * presque toujours le cas ici : deux voiles `BACKDROP` l'un sur l'autre
   * font deux tiers de brun sur tout l'écran.
   */
  veil?: "full" | "soft";
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * "Are you sure?", asked in the app's own hand.
 *
 * The system alert was doing this job and doing it in a different typeface, on
 * a different card, with buttons of a different shape — a grey slab from
 * another application appearing in the middle of a hand-coloured map. Worse, it
 * is the one moment where the reader is about to lose something, which is
 * exactly when an interface should look like it knows what it is doing.
 *
 * Mounted **inside** the sheet or modal it belongs to, never at the root: iOS
 * refuses to present a second modal from a controller that is already
 * presenting one, so a confirmation floating at the top of the tree would
 * simply never appear over an open sheet.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  tone = "danger",
  cancelLabel = null,
  veil = "full",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      visible={visible}
      veil={veil}
      onClose={onClose}
      title={title}
      hint={message}
      /* Jamais celui de `Dialog` : il le dessine en `quiet`, c'est-à-dire en
         texte nu sur le papier, et « Annuler » ne ressortait pas du fond. Quand
         il est nommé, il est dessiné ici, en plein et à côté de l'autre — deux
         réponses à une question se posent côte à côte. Sans lui, la croix
         reste la sortie, et une seule réponse occupe le pied. */
      dismissLabel={null}
    >
      {cancelLabel === null ? (
        <InkButton
          label={confirmLabel}
          variant="solid"
          tone={tone}
          onPress={onConfirm}
        />
      ) : (
        /* `grow` est à sa place ici, et seulement ici : c'est une rangée.
           En enfant direct de la colonne de `Dialog`, il donnerait aux deux
           boutons une base nulle — voir le commentaire de `Dialog`. */
        <View style={styles.pair}>
          <InkButton
            label={cancelLabel}
            variant="tonal"
            grow
            onPress={onClose}
          />
          <InkButton
            label={confirmLabel}
            variant="solid"
            tone={tone}
            grow
            onPress={onConfirm}
          />
        </View>
      )}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: space.sm },
});
