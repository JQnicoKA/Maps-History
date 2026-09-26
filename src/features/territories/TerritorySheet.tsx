import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useHidden } from "./HiddenProvider";
import { Dialog, InkButton, useNotice } from "../../components/ui";
import { formatYear } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

/** What a tap on the plate turned up. */
export type TouchedTerritory = {
  name: string;
  /** Absent when the feature carried none — the map is not always sure. */
  from?: number;
  to?: number;
};

export type TerritorySheetProps = {
  territory: TouchedTerritory | null;
  onClose: () => void;
};

/**
 * A territory the reader has touched, and the one thing they can do with it.
 *
 * Removing it does not delete anything: `polities` is reference data, shared
 * by every account and reloadable from Cliopatria. This hides the entity on
 * this reader's map, for every century at once, and it can be brought back
 * from the account card.
 */
export function TerritorySheet({ territory, onClose }: TerritorySheetProps) {
  const { hide } = useHidden();
  const [busy, setBusy] = useState(false);
  const { say, dialog } = useNotice();

  const period =
    territory?.from === undefined || territory.to === undefined
      ? null
      : `${formatYear(territory.from)} – ${formatYear(territory.to)}`;

  return (
    <Dialog
      visible={territory !== null}
      onClose={onClose}
      title={territory?.name ?? ""}
      hint={period ?? undefined}
      dismissLabel="Fermer"
    >
      {dialog}

      <Text style={styles.line}>
        Le retirer ne l'efface pas : il disparaît de votre carte, à toutes les
        époques, et vous pourrez le rétablir depuis votre compte.
      </Text>

      <InkButton
        label={busy ? "…" : "Retirer de ma carte"}
        variant="solid"
        tone="danger"
        disabled={busy || territory === null}
        onPress={() => {
          if (!territory) return;
          setBusy(true);
          void hide(territory.name)
            .then(onClose)
            .catch((cause: unknown) =>
              say(
                "Impossible de le retirer",
                cause instanceof Error ? cause.message : String(cause),
              ),
            )
            .finally(() => setBusy(false));
        }}
      />
    </Dialog>
  );
}

/** The list, and the way back — shown wherever the account is managed. */
export function HiddenTerritories() {
  const { hidden, show } = useHidden();
  const [busy, setBusy] = useState<string | null>(null);

  if (hidden.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.legend}>
        {hidden.length === 1
          ? "1 territoire retiré"
          : `${hidden.length} territoires retirés`}
      </Text>
      {hidden.map((name) => (
        <InkButton
          key={name}
          label={busy === name ? "…" : `Rétablir ${name}`}
          variant="tonal"
          disabled={busy !== null}
          onPress={() => {
            setBusy(name);
            void show(name).finally(() => setBusy(null));
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { ...type.caption, color: palette.inkSoft },
  section: { gap: space.sm },
  legend: { ...type.legend, color: palette.inkSoft },
});
