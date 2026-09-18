import { useEffect, useState } from "react";

import { Dialog } from "./Dialog";
import { InkButton } from "./InkButton";
import { InkField } from "./InkField";

export type PromptDialogProps = {
  visible: boolean;
  title: string;
  /** What the field is for, over it. */
  label: string;
  placeholder?: string;
  /** What the field holds when it opens — a name being changed, usually. */
  initial?: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
};

/**
 * One line of text, asked for in the app's own hand.
 *
 * `Alert.prompt` did this before, which is iOS-only — on Android it is simply
 * `undefined`, and the rename it guarded did nothing at all. This works
 * everywhere and looks like the rest of the app.
 *
 * Blank is not an answer: the button stays out of reach until something is
 * typed, rather than accepting the tap and quietly doing nothing.
 */
export function PromptDialog({
  visible,
  title,
  label,
  placeholder,
  initial = "",
  confirmLabel,
  onConfirm,
  onClose,
}: PromptDialogProps) {
  const [value, setValue] = useState(initial);

  // Re-opened on a different subject, or on the same one after an edit was
  // abandoned: the field starts from what is true now, not from last time.
  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);

  return (
    <Dialog visible={visible} onClose={onClose} title={title}>
      <InkField
        label={label}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        autoFocus
      />
      <InkButton
        label={confirmLabel}
        variant="solid"
        disabled={value.trim() === ""}
        onPress={() => onConfirm(value.trim())}
      />
    </Dialog>
  );
}
