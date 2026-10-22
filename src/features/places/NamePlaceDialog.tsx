import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Dialog, InkButton, InkField } from "../../components/ui";
import { HISTORY } from "../../config/history";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

export type NamedPlace = { name: string; from: number; to: number | null };

export type NamePlaceDialogProps = {
  visible: boolean;
  busy: boolean;
  onConfirm: (place: NamedPlace) => void;
  onClose: () => void;
};

/** A year as typed, or null if it is not one this map can show. */
function readYear(text: string): number | null {
  const value = Number.parseInt(text.trim(), 10);
  if (Number.isNaN(value)) return null;
  return value >= HISTORY.from && value <= HISTORY.to ? value : null;
}

/**
 * Les trois choses qu'une ville demande, dont une facultative.
 *
 * Demandées après avoir visé et non avant, comme pour un territoire : on sait
 * ce qu'on vient de poser, alors qu'on ne sait pas encore ce qu'on va poser.
 *
 * **La fondation est obligatoire, la disparition ne l'est pas.** Une ville
 * sans début ne paraîtrait à aucune date, ce qui est un point que personne ne
 * reverrait jamais. Une ville sans fin, au contraire, est le cas ordinaire :
 * elle est encore là. C'est déjà la convention du jeu de référence, où 16 502
 * lieux sur 23 279 n'ont pas d'année de fin.
 */
export function NamePlaceDialog({
  visible,
  busy,
  onConfirm,
  onClose,
}: NamePlaceDialogProps) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const start = readYear(from);
  /** Vide est une réponse : elle y est encore. Mal écrit n'en est pas une. */
  const blank = to.trim() === "";
  const end = blank ? null : readYear(to);
  const unreadable = !blank && end === null;
  const backwards = start !== null && end !== null && end < start;
  const ready = name.trim() !== "" && start !== null && !unreadable && !backwards;

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Votre ville"
      hint="Elle apparaîtra sur la carte à partir de cette année."
      dismissLabel="Annuler"
    >
      <InkField
        label="Nom"
        value={name}
        onChangeText={setName}
        placeholder="Carthage"
        autoFocus
      />

      <View style={styles.years}>
        <View style={styles.year}>
          <InkField
            label="Fondée en"
            value={from}
            onChangeText={setFrom}
            placeholder="-814"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.year}>
          <InkField
            label="Disparue en"
            value={to}
            onChangeText={setTo}
            placeholder="facultatif"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      <Text style={styles.hint}>
        {backwards
          ? "La fin précède le début."
          : unreadable
            ? `Une année entre ${HISTORY.from} et ${HISTORY.to}, ou rien du tout.`
            : blank
              ? `Laissez la fin vide si elle est encore là. De ${HISTORY.from} à nos jours.`
              : `De ${HISTORY.from} à nos jours.`}
      </Text>

      {/* Plus d'avertissement de doublon ici.
          Il interrogeait la communauté : « quelqu'un a déjà posé cette
          Carthage ». Mais une ville ne se partage plus — elle reste au
          lecteur, ou le conservateur la promeut dans le fond de carte, où
          elle est unique par construction. Il n'y a donc plus de doublon
          possible à annoncer, et prévenir de ce qui n'arrivera pas est pire
          que se taire. */}

      <InkButton
        label={busy ? "Enregistrement…" : "Enregistrer"}
        variant="solid"
        disabled={!ready || busy}
        onPress={() => {
          if (start === null) return;
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
