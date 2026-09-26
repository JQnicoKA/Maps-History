import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Dialog, InkButton, InkField } from "../../components/ui";
import { HISTORY } from "../../config/history";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

export type NamedPolity = { name: string; from: number; to: number };

export type NamePolityDialogProps = {
  visible: boolean;
  busy: boolean;
  onConfirm: (polity: NamedPolity) => void;
  onClose: () => void;
};

/** A year as typed, or null if it is not one this map can show. */
function readYear(text: string): number | null {
  const value = Number.parseInt(text.trim(), 10);
  if (Number.isNaN(value)) return null;
  return value >= HISTORY.from && value <= HISTORY.to ? value : null;
}

/**
 * The three things a painted shape needs before it is a territory.
 *
 * Asked after the painting and not before, because the reader who has just
 * traced a coastline knows what they drew — while someone asked to name a
 * thing they have not yet made is being asked to plan.
 *
 * The dates are not optional and cannot be: a territory with no period would
 * never appear at any date, which is a shape nobody would ever see again.
 */
export function NamePolityDialog({
  visible,
  busy,
  onConfirm,
  onClose,
}: NamePolityDialogProps) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const start = readYear(from);
  const end = readYear(to);
  const backwards = start !== null && end !== null && end < start;
  const ready = name.trim() !== "" && start !== null && end !== null && !backwards;

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Votre territoire"
      hint="Il apparaîtra sur la carte entre ces deux dates."
      dismissLabel="Annuler"
    >
      <InkField
        label="Nom"
        value={name}
        onChangeText={setName}
        placeholder="Duché de Bourgogne"
        autoFocus
      />

      <View style={styles.years}>
        <View style={styles.year}>
          <InkField
            label="De l'année"
            value={from}
            onChangeText={setFrom}
            placeholder="1363"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.year}>
          <InkField
            label="À l'année"
            value={to}
            onChangeText={setTo}
            placeholder="1477"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      <Text style={styles.hint}>
        {backwards
          ? "La fin précède le début."
          : `Une année négative est avant Jésus-Christ ; de ${HISTORY.from} à ${HISTORY.to}.`}
      </Text>

      <InkButton
        label={busy ? "Enregistrement…" : "Enregistrer"}
        variant="solid"
        disabled={!ready || busy}
        onPress={() => {
          if (start === null || end === null) return;
          onConfirm({ name: name.trim(), from: start, to: end });
        }}
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  years: { flexDirection: "row", gap: space.sm },
  year: { flex: 1 },
  hint: { ...type.caption, color: palette.inkFaint },
});
