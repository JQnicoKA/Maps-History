import { Dialog, InkButton } from "../../components/ui";

/** What the next taps on the canvas will do. */
export type LinkMode = "couple" | "descent" | "erase";

export type LinkChoiceProps = {
  visible: boolean;
  onChoose: (mode: LinkMode) => void;
  onClose: () => void;
};

/** Couple, descent, or erase — asked before the canvas changes meaning. */
export function LinkChoice({ visible, onChoose, onClose }: LinkChoiceProps) {
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Modifier les liens"
      hint="Choisissez ce que les prochains touchers vont faire."
    >
      <InkButton
        label="Créer un couple"
        variant="tonal"
        onPress={() => onChoose("couple")}
      />
      <InkButton
        label="Créer une descendance"
        variant="tonal"
        onPress={() => onChoose("descent")}
      />
      <InkButton
        label="Supprimer un lien"
        variant="solid"
        tone="danger"
        onPress={() => onChoose("erase")}
      />
    </Dialog>
  );
}
