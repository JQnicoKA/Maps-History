import { StyleSheet, Text, View } from "react-native";

import { InkButton, SegmentedControl } from "../../components/ui";
import { palette } from "../../theme/palette";
import { shadow, space, type } from "../../theme/tokens";

const PENCIL = require("../../../assets/icons/pencil-draw.png");
const ERASER = require("../../../assets/icons/eraser.png");
const HAND = require("../../../assets/icons/hand.png");

/**
 * Ce qu'un doigt fait en ce moment.
 *
 * Trois, et la gomme s'est glissée entre les deux autres parce qu'elle est
 * du même ordre que le pinceau : on colorie dans les deux cas, et seul le
 * signe change. La main, elle, interrompt le dessin pour regarder ailleurs.
 */
export type Tool = "brush" | "eraser" | "hand";

export type DrawPolityBarProps = {
  strokes: number;
  busy: boolean;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onCancel: () => void;
  onFinish: () => void;
  bottom: number;
};

/**
 * What the reader is told, and can do, while painting.
 *
 * The switch between brush and hand is the first thing on it, because it is
 * the only thing about this screen that cannot be guessed — see `BrushOverlay`
 * for why a gesture could not carry that decision instead.
 */
export function DrawPolityBar({
  strokes,
  busy,
  tool,
  onToolChange,
  onCancel,
  onFinish,
  bottom,
}: DrawPolityBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: bottom }]}>
      {/* The switch first, because it decides what a finger means — and what
          a finger means is the only thing about this screen that is not
          obvious. */}
      <SegmentedControl segments={MODES} value={tool} onChange={onToolChange} />

      <Text style={styles.hint}>
        {tool === "hand"
          ? "Déplacez et zoomez la carte librement"
          : tool === "eraser"
            ? "Repassez sur la peinture pour l'ôter."
            : strokes === 0
              ? "Peignez le territoire avec le doigt."
              : `${strokes} coup${strokes > 1 ? "s" : ""} de pinceau.`}
      </Text>

      {/* Deux boutons, et il y en eut trois. « Effacer » défaisait le dernier
          coup : une annulation déguisée en gomme, qui ne savait retirer que
          dans l'ordre inverse de la pose. La vraie gomme l'a rendu inutile —
          on ôte là où l'on veut, autant de fois qu'on veut.

          « Annuler » passe en tonal : à parts égales avec « Terminer », un
          bouton sans fond ne se lisait pas comme un bouton. */}
      <View style={styles.row}>
        <InkButton label="Annuler" variant="tonal" grow onPress={onCancel} />
        <InkButton
          label={busy ? "…" : "Terminer"}
          variant="solid"
          grow
          disabled={strokes === 0 || busy}
          onPress={onFinish}
        />
      </View>
    </View>
  );
}

const MODES: { value: Tool; label: string; icon: number }[] = [
  { value: "brush", label: "Pinceau", icon: PENCIL },
  { value: "eraser", label: "Gomme", icon: ERASER },
  { value: "hand", label: "Déplacer", icon: HAND },
];

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: palette.surfaceRaised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    ...shadow.lifted,
  },
  hint: { ...type.caption, color: palette.inkSoft, textAlign: "center" },
  row: { flexDirection: "row", gap: space.sm },
});
