import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { useHidden } from "./HiddenProvider";
import { Dialog, InkButton, useNotice } from "../../components/ui";
import { BORDERS_END } from "../../config/history";
import { formatYear } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { type } from "../../theme/tokens";

/** What a tap on the plate turned up. */
export type TouchedTerritory = {
  name: string;
  id: string;
  /** True when the reader painted it; false when it came with the map. */
  drawn: boolean;
  /** The years this shape holds good for. */
  from: number;
  to: number;
};

/**
 * The span, in the words each kind of territory deserves.
 *
 * They are not the same claim. A drawn territory's dates are the reader's
 * own — they typed them, and "de 1789 à 1815" is exactly what they said. The
 * reference set is cut into slices: Cliopatria records the Byzantine Empire
 * as dozens of separate shapes, one per time its borders moved, so 638–640 is
 * the life of a *border*, not of an empire. Printing that as though it were
 * the entity's lifetime would have the map claiming Byzantium lasted two
 * years.
 */
function span(territory: TouchedTerritory): string {
  const { from, to, drawn } = territory;
  if (drawn) {
    return from === to
      ? `En ${formatYear(from)}.`
      : `De ${formatYear(from)} à ${formatYear(to)}.`;
  }
  if (to >= BORDERS_END) return `Ces frontières depuis ${formatYear(from)}.`;
  return from === to
    ? `Ces frontières en ${formatYear(from)}.`
    : `Ces frontières de ${formatYear(from)} à ${formatYear(to)}.`;
}

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
      hint={
        territory === null
          ? undefined
          : [span(territory), mine ? "Vous l'avez dessiné." : null]
              .filter(Boolean)
              .join(" ")
      }
      /* The cross in the corner is the way out; a "Fermer" underneath the
         one real choice would only say the same thing twice. */
      dismissLabel={null}
    >
      {dialog}

      <Text style={styles.line}>
        {mine
          ? "Le supprimer est définitif : il n'existe que sur votre carte."
          : "Le retirer ne l'efface pas : il disparaît de votre carte, à toutes les époques, et vous pourrez le rétablir depuis le bouton territoires."}
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
