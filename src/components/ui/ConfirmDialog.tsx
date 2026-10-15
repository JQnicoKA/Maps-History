import { Dialog } from "./Dialog";
import { InkButton } from "./InkButton";

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
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={title}
      hint={message}
      /* Rien par défaut : devant une suppression, "Annuler" et la croix font
         exactement la même chose, et l'un des deux serait du mobilier devant
         une décision qui mérite un écran dégagé. Nommé en revanche quand la
         question n'est pas un avertissement. */
      dismissLabel={cancelLabel}
    >
      <InkButton
        label={confirmLabel}
        variant="solid"
        tone={tone}
        onPress={onConfirm}
      />
    </Dialog>
  );
}
