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
  /**
   * Le territoire qu'on reprend : son nom et ses années, déjà écrits.
   *
   * Rien quand on en peint un neuf. Reprendre un dessin et devoir renommer
   * ce qu'on reprend serait une façon de perdre le nom à chaque retouche.
   */
  known?: NamedPolity | null;
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
  known = null,
  onConfirm,
  onClose,
}: NamePolityDialogProps) {
  const [name, setName] = useState(known?.name ?? "");
  const [from, setFrom] = useState(
    known ? String(known.from) : "",
  );
  const [to, setTo] = useState(known ? String(known.to) : "");

  const start = readYear(from);
  const end = readYear(to);
  const backwards = start !== null && end !== null && end < start;
  const ready = name.trim() !== "" && start !== null && end !== null && !backwards;

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={known ? "Modifier le territoire" : "Votre territoire"}
      hint="Il apparaîtra sur la carte entre ces deux dates."
      /* Rien au pied : les deux réponses tiennent une seule ligne dans le
         corps — voir plus bas. Laissé à `Dialog`, « Annuler » se serait posé
         sous « Enregistrer » au lieu d'être à côté. */
      dismissLabel={null}
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
          : `De ${HISTORY.from} à nos jours.`}
      </Text>

      {/* Plus d'avertissement de doublon ici.
          Il interrogeait la communauté : « quelqu'un a déjà peint ce
          territoire-là ». Mais un territoire ne se partage plus — il reste au
          lecteur, ou le conservateur le promeut dans le fond de carte, où il
          est unique par construction. Il n'y a donc plus de doublon possible
          à annoncer. */}

      {/* À parts égales sur une ligne, la sortie à gauche et ce qu'on est
          venu faire à droite — la mise des pieds de feuille de
          l'application. */}
      <View style={styles.actions}>
        <InkButton label="Annuler" variant="tonal" grow onPress={onClose} />
        <InkButton
          label={busy ? "Enregistrement…" : "Enregistrer"}
          variant="solid"
          grow
          disabled={!ready || busy}
          onPress={() => {
            if (start === null || end === null) return;
            onConfirm({ name: name.trim(), from: start, to: end });
          }}
        />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  /** Les deux réponses, à parts égales : chacune porte `grow`. */
  actions: { flexDirection: "row", gap: space.sm },
  years: { flexDirection: "row", gap: space.sm },
  year: { flex: 1 },
  hint: { ...type.caption, color: palette.inkFaint },
});
