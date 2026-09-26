import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { useHidden } from "./HiddenProvider";
import { Dialog, InkButton, useNotice } from "../../components/ui";
import { palette } from "../../theme/palette";
import { type } from "../../theme/tokens";

/** What a tap on the plate turned up. */
export type TouchedTerritory = {
  name: string;
  id: string;
  /** True when the reader painted it; false when it came with the map. */
  drawn: boolean;
};

export type TerritorySheetProps = {
  territory: TouchedTerritory | null;
  onClose: () => void;
};

/**
 * A territory the reader has touched, and the one thing they can do with it.
 *
 * Which one depends on where it came from, and the difference is real rather
 * than cosmetic:
 *
 * - **It came with the map.** `polities` is reference data, shared by every
 *   account and reloadable from Cliopatria — nobody may delete from it. The
 *   entity is masked on this reader's map, for every century at once, and can
 *   be brought back.
 * - **The reader painted it.** It is theirs, it exists nowhere else, and
 *   removing it removes it. There is nothing to mask and nothing to restore,
 *   so the card says so rather than promising otherwise.
 */
export function TerritorySheet({ territory, onClose }: TerritorySheetProps) {
  const { hide, erase } = useHidden();
  const [busy, setBusy] = useState(false);
  const { say, dialog } = useNotice();

  const mine = territory?.drawn === true;

  return (
    <Dialog
      visible={territory !== null}
      onClose={onClose}
      title={territory?.name ?? ""}
      hint={mine ? "Vous avez dessiné ce territoire." : undefined}
      dismissLabel="Fermer"
    >
      {dialog}

      <Text style={styles.line}>
        {mine
          ? "Le supprimer est définitif : il n'existe que sur votre carte."
          : "Le retirer ne l'efface pas : il disparaît de votre carte, à toutes les époques, et vous pourrez le rétablir depuis le crayon."}
      </Text>

      <InkButton
        label={
          busy ? "…" : mine ? "Supprimer définitivement" : "Retirer de ma carte"
        }
        variant="solid"
        tone="danger"
        disabled={busy || territory === null}
        onPress={() => {
          if (!territory) return;
          setBusy(true);
          void (mine ? erase(territory.id) : hide(territory.name))
            .then(onClose)
            .catch((cause: unknown) =>
              say(
                mine ? "Suppression impossible" : "Impossible de le retirer",
                cause instanceof Error ? cause.message : String(cause),
              ),
            )
            .finally(() => setBusy(false));
        }}
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  line: { ...type.caption, color: palette.inkSoft },
});
