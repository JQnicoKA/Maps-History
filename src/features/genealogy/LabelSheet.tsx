import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Chip, InkButton, InkField, Sheet } from "../../components/ui";
import {
  LABEL_WIDTHS,
  type LabelWidth,
  type TreeLabel,
} from "../events/types";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

export type LabelSheetProps = {
  visible: boolean;
  /** L'étiquette à reprendre, ou `null` pour en écrire une neuve. */
  label: TreeLabel | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (text: string, width: LabelWidth) => void;
  /** Absent sur une étiquette qui n'existe pas encore. */
  onRemove?: () => void;
};

/** Combien de colonnes, dit en mots plutôt qu'en chiffres nus. */
const SAID: Record<LabelWidth, string> = {
  1: "1 colonne",
  2: "2 colonnes",
  3: "3 colonnes",
};

/**
 * Ce qu'une étiquette dit, et la place qu'elle prend.
 *
 * Deux réglages et rien d'autre : une étiquette n'a ni dates, ni point sur la
 * carte, ni poids dans l'arbre. C'est ce qui la distingue d'un personnage, et
 * une feuille courte le dit mieux qu'une phrase.
 *
 * Elle s'ouvre au **toucher** d'une étiquette, là où un maintien la décolle
 * pour la déplacer. Le même partage que pour un personnage : toucher pour
 * lire ou écrire, maintenir pour ranger.
 */
export function LabelSheet({
  visible,
  label,
  busy = false,
  onClose,
  onSave,
  onRemove,
}: LabelSheetProps) {
  const [text, setText] = useState("");
  const [width, setWidth] = useState<LabelWidth>(1);

  /**
   * Repris à chaque ouverture, et c'est voulu : la feuille reste montée entre
   * deux étiquettes, donc sans ça la seconde s'ouvrirait sur le texte de la
   * première.
   */
  useEffect(() => {
    if (!visible) return;
    setText(label?.text ?? "");
    setWidth(label?.width ?? 1);
  }, [visible, label]);

  const ready = text.trim().length > 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={label === null ? "Nouvelle étiquette" : "Étiquette"}
      footer={
        <>
          <InkButton label="Annuler" variant="tonal" onPress={onClose} />
          <InkButton
            label={busy ? "…" : "Enregistrer"}
            variant="solid"
            grow
            disabled={!ready || busy}
            onPress={() => onSave(text, width)}
          />
        </>
      }
    >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <InkField
          label="Ce qui est écrit"
          value={text}
          onChangeText={setText}
          placeholder="Maison de Bourgogne, 1066, la branche cadette…"
          maxLength={80}
          autoFocus={label === null}
        />
        <Text style={styles.aside}>
          Quelques mots, pas un paragraphe : une étiquette titre une branche,
          elle ne la raconte pas.
        </Text>

        <View style={styles.rule} />

        <Text style={styles.legend}>Largeur</Text>
        <View style={styles.widths}>
          {LABEL_WIDTHS.map((one) => (
            <Chip
              key={one}
              label={SAID[one]}
              selected={width === one}
              onPress={() => setWidth(one)}
            />
          ))}
        </View>
        <Text style={styles.aside}>
          Une étiquette large enjambe les gouttières : elle occupe la place de
          deux ou trois cartes, et pousse ses voisines comme le ferait un
          couple.
        </Text>

        {onRemove === undefined ? null : (
          <>
            <View style={styles.rule} />
            <InkButton
              label="Retirer l'étiquette"
              variant="quiet"
              tone="danger"
              disabled={busy}
              onPress={onRemove}
            />
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.md,
  },
  legend: { ...type.legend, color: palette.inkSoft },
  aside: { ...type.caption, color: palette.inkFaint },
  widths: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.line,
    marginVertical: space.xs,
  },
});
