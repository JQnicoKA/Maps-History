import { Dialog } from "./Dialog";
import { InkButton } from "./InkButton";

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  /** What is at stake, in a line or two. */
  message?: string;
  /** The word on the red button: "Supprimer", "Retirer"… */
  confirmLabel: string;
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
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog visible={visible} onClose={onClose} title={title} hint={message}>
      <InkButton
        label={confirmLabel}
        variant="solid"
        tone="danger"
        onPress={onConfirm}
      />
    </Dialog>
  );
}
