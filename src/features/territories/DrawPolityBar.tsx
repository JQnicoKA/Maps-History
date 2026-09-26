import { StyleSheet, Text, View } from "react-native";

import { InkButton, SegmentedControl } from "../../components/ui";
import { palette } from "../../theme/palette";
import { shadow, space, type } from "../../theme/tokens";

const PENCIL = require("../../../assets/icons/pencil-draw.png");
const HAND = require("../../../assets/icons/hand.png");

export type DrawPolityBarProps = {
  strokes: number;
  busy: boolean;
  /** True while the brush has the screen; false while the map does. */
  painting: boolean;
  onPaintingChange: (painting: boolean) => void;
  onUndo: () => void;
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
  painting,
  onPaintingChange,
  onUndo,
  onCancel,
  onFinish,
  bottom,
}: DrawPolityBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: bottom }]}>
      {/* The switch first, because it decides what a finger means — and what
          a finger means is the only thing about this screen that is not
          obvious. */}
      <SegmentedControl
        segments={MODES}
        value={painting ? "brush" : "hand"}
        onChange={(mode) => onPaintingChange(mode === "brush")}
      />

      <Text style={styles.hint}>
        {painting
          ? strokes === 0
            ? "Peignez le territoire avec le doigt."
            : `${strokes} coup${strokes > 1 ? "s" : ""} de pinceau.`
          : "Déplacez et zoomez la carte librement"}
      </Text>

      <View style={styles.row}>
        <InkButton label="Annuler" variant="quiet" grow onPress={onCancel} />
        <InkButton
          label="Effacer"
          variant="tonal"
          grow
          disabled={strokes === 0 || busy}
          onPress={onUndo}
        />
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

const MODES = [
  { value: "brush" as const, label: "Pinceau", icon: PENCIL },
  { value: "hand" as const, label: "Déplacer", icon: HAND },
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
    backgroundColor: palette.paperLight,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    ...shadow.lifted,
  },
  hint: { ...type.caption, color: palette.inkSoft, textAlign: "center" },
  row: { flexDirection: "row", gap: space.sm },
});
