import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { canvasSize, connectors, place } from "./layout";
import { PanZoom } from "./PanZoom";
import { TreeFace, type Face } from "./TreeFace";
import { InkButton } from "../../components/ui";
import type { Tree } from "../events/types";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

export type TreePreviewProps = {
  /** The drawing, and the faces its members wear. */
  tree: Tree;
  faces: Map<string, Face>;
  said: string;
  /** Who drew it, and how many readers have kept it. */
  by: string;
  /** False when it is the reader's own, or already taken. */
  takeable: boolean;
  busy: boolean;
  onTake: () => void;
  onClose: () => void;
  /**
   * What the two bars must keep clear at the top and bottom.
   *
   * Taken from the caller rather than from the safe area, because this is
   * laid inside a panel as often as over the screen, and a panel's edges are
   * not the phone's.
   */
  inset?: { top: number; bottom: number };
};

/**
 * Somebody else's genealogy, read rather than built.
 *
 * Full screen and not a card, for the same reason the builder is: a lineage
 * of forty across six generations has no business in a panel, and a reader
 * deciding whether to take one needs to see its shape. Dragged and pinched
 * like the builder — that much is the same drawing — and nothing else. No
 * holding a card, no crosses, no lines to trace: every gesture here would be
 * an offer to change something that is not the reader's.
 *
 * It shares `TreeFace` and the whole of `layout` with the builder, which is
 * what keeps the two drawings the same drawing.
 */
export function TreePreview({
  tree,
  faces,
  said,
  by,
  takeable,
  busy,
  onTake,
  onClose,
  inset = { top: 0, bottom: 0 },
}: TreePreviewProps) {
  const placed = useMemo(() => place(tree), [tree]);
  const lines = useMemo(() => connectors(tree, placed), [tree, placed]);
  const size = useMemo(() => canvasSize(tree), [tree]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <PanZoom
        content={size}
        // What the two bars cover, so the drawing never hides behind them.
        inset={{ top: inset.top + 92, bottom: inset.bottom + 108 }}
        subject={tree.id}
      >
        {lines.map(({ cut: _cut, ...box }, index) => (
          <View key={index} style={[styles.line, box]} pointerEvents="none" />
        ))}

        {placed.map((node) => (
          <View
            key={node.member.id}
            style={[styles.holder, { left: node.x, top: node.y }]}
            pointerEvents="none"
          >
            <TreeFace
              face={faces.get(node.member.characterId)}
              importance={node.member.importance}
            />
          </View>
        ))}
      </PanZoom>

      {/* The heading of a page, not a label on a strip: a genealogy's name
          and what it holds are the two things a reader weighs before taking
          it, and they were being read off a band barely taller than the
          words. */}
      <View style={[styles.bar, { paddingTop: inset.top + space.lg }]}>
        <Text style={styles.name} numberOfLines={2}>
          {tree.name}
        </Text>
        <View style={styles.rule} />
        <Text style={styles.said} numberOfLines={2}>
          {said} · {by}
        </Text>
      </View>

      <View
        style={[styles.foot, { paddingBottom: inset.bottom + space.lg }]}
      >
        <InkButton label="Fermer" variant="tonal" grow onPress={onClose} />
        {takeable ? (
          <InkButton
            label={busy ? "…" : "Copier l'arbre"}
            variant="solid"
            grow
            disabled={busy}
            onPress={onTake}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: palette.paper },
  line: { position: "absolute", backgroundColor: palette.inkSoft },
  holder: { position: "absolute" },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xs,
    backgroundColor: palette.paperLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  name: { ...type.plate, fontSize: 21, color: palette.ink },
  /** Drawn under the name, the way every heading in this app is. */
  rule: {
    height: 3,
    width: "38%",
    minWidth: 48,
    borderRadius: radius.pill,
    backgroundColor: palette.paperDeep,
  },
  said: { ...type.caption, color: palette.inkSoft, marginTop: 2 },

  foot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    backgroundColor: palette.paperLight,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.lifted,
  },
});
