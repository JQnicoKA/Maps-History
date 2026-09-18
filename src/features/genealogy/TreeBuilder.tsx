import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  canvasSize,
  columnX,
  connectors,
  FACE_AXIS,
  frame,
  NODE,
  place,
  rowCount,
  rowY,
} from "./layout";
import { PanZoom } from "./PanZoom";
import { TreeMemberSheet } from "./TreeMemberSheet";
import { TreeNode } from "./TreeNode";
import { InkButton, SelectField } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { lifespan } from "../events/lifespan";
import type { Tree, TreeBond, TreeMember } from "../events/types";
import { palette } from "../../theme/palette";
import { radius, shadow, space, TOUCH, type } from "../../theme/tokens";

/** The line under construction: what kind, and which end is fixed. */
type Tracing = { kind: TreeBond | null; anchor: string | null };

export type TreeBuilderProps = {
  tree: Tree | null;
  onClose: () => void;
};

/**
 * The tree, and the tools to build it.
 *
 * Full screen, not a bottom sheet: a genealogy is wide and deep by nature, and
 * arranging one through a letterbox would be a punishment. The canvas is
 * dragged in both directions and pinched to zoom, and the chrome floats over
 * it — the bars' measured height is handed to `PanZoom`, which keeps the
 * drawing out from under them.
 *
 * Two modes, and only two. Normally a tap opens someone's card. **Tracer un
 * lien**, at the top right, starts the other: choose couple or descent, touch
 * one person, and then touch everyone to be joined to them — touching again
 * erases the line. Only the members that can legally take that link stay lit,
 * so the rule is shown rather than explained and there is no wrong move to
 * refuse. No dragging, no hidden gesture; the bar at the foot says where you
 * are and how to leave.
 */
export function TreeBuilder({ tree, onClose }: TreeBuilderProps) {
  const insets = useSafeAreaInsets();
  const { characters, addToTree, linkInTree, removeTree, renameTree } = useEvents();

  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * The line being drawn, if any.
   *
   * Three stages in one value: `null` is the ordinary mode; a `kind` of `null`
   * is the moment between pressing the button and saying which kind; and an
   * anchor set means the far end is being chosen.
   */
  const [tracing, setTracing] = useState<Tracing | null>(null);
  /** Which generation the picker is adding to. */
  const [adding, setAdding] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * How much room the two floating bars take.
   *
   * Measured rather than computed: their height depends on the safe area, on
   * whether the linking banner has wrapped to two lines, and on the font the
   * reader has chosen. A number written here would be wrong on some phone.
   */
  const [chrome, setChrome] = useState({ top: 0, bottom: 0 });

  const placed = useMemo(() => (tree ? place(tree) : []), [tree]);
  const lines = useMemo(
    () => (tree ? connectors(tree, placed) : []),
    [tree, placed],
  );
  const size = useMemo(
    () => (tree ? canvasSize(tree) : { width: 0, height: 0 }),
    [tree],
  );

  if (!tree) return null;

  const rows = frame(tree);
  const byId = new Map(characters.map((person) => [person.id, person]));
  const open = tree.members.find((member) => member.id === openId) ?? null;
  const bond = tracing?.kind ?? null;
  const anchor =
    tree.members.find((member) => member.id === tracing?.anchor) ?? null;

  /** Who the anchor already holds a line of this kind to. */
  const attached = new Set<string>();
  if (anchor && bond) {
    for (const link of tree.links) {
      if (link.kind !== bond) continue;
      if (link.from === anchor.id) attached.add(link.to);
      // A couple has no direction, so the row may have been written either way
      // round; a descent read backwards would put a child above its parent.
      else if (bond === "couple" && link.to === anchor.id) attached.add(link.from);
    }
  }

  /**
   * Whether this member may take the line being drawn.
   *
   * The whole rule of the feature, in three lines: a couple runs along a row,
   * a descent runs into the row below. Everyone else is dimmed, which is why
   * nothing here ever has to refuse a tap with an alert.
   */
  const reachable = (member: TreeMember): boolean => {
    if (!bond) return false;
    if (!anchor || member.id === anchor.id) return true;
    return bond === "couple"
      ? member.generation === anchor.generation
      : member.generation === anchor.generation + 1;
  };

  const run = (work: Promise<unknown>) => {
    setBusy(true);
    void work
      .catch((cause: unknown) =>
        Alert.alert(
          "Modification impossible",
          cause instanceof Error ? cause.message : String(cause),
        ),
      )
      .finally(() => setBusy(false));
  };

  const tap = (member: TreeMember) => {
    if (!tracing) {
      setOpenId(member.id);
      return;
    }
    if (!bond || !reachable(member)) return;
    if (!anchor) {
      setTracing({ kind: bond, anchor: member.id });
      return;
    }
    // Touching the anchor again lets go of it, so a mis-tap costs one tap
    // rather than a trip out of the mode and back in.
    if (member.id === anchor.id) {
      setTracing({ kind: bond, anchor: null });
      return;
    }
    run(
      linkInTree(tree.id, bond, anchor.id, member.id, !attached.has(member.id)),
    );
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <PanZoom content={size} inset={chrome} subject={tree.id}>
        {lines.map((segment, index) => (
          <View
            key={index}
            style={[styles.line, segment]}
            pointerEvents="none"
          />
        ))}

        {placed.map((node) => (
          <TreeNode
            key={node.member.id}
            member={node.member}
            person={byId.get(node.member.characterId)}
            x={node.x}
            y={node.y}
            active={
              tracing !== null &&
              (node.member.id === anchor?.id || attached.has(node.member.id))
            }
            muted={tracing !== null && !reachable(node.member)}
            onPress={() => tap(node.member)}
          />
        ))}

        {/* One slot closing every row, the two empty ones included —
            which is how a generation is added above or below without a
            button anywhere else to explain it. */}
        {Array.from(
          { length: rows.to - rows.from + 1 },
          (_, index) => rows.from + index,
        ).map((generation) => (
          <Pressable
            key={generation}
            accessibilityRole="button"
            accessibilityLabel={
              rowCount(tree, generation) === 0
                ? "Ajouter une génération"
                : "Ajouter à cette génération"
            }
            disabled={busy || tracing !== null}
            onPress={() => setAdding(generation)}
            style={({ pressed }) => [
              styles.slot,
              tracing !== null && styles.away,
              pressed && styles.pressed,
              {
                left: columnX(rowCount(tree, generation)),
                top: rowY(generation, rows),
              },
            ]}
          >
            <Text style={styles.slotGlyph}>+</Text>
          </Pressable>
        ))}
        </PanZoom>

        <View
          style={[styles.top, { paddingTop: insets.top + space.sm }]}
          // Read before the updater runs: a functional setState is called on
          // the next render, by which time React Native has recycled the
          // synthetic event and nulled its `nativeEvent`.
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setChrome((current) => ({ ...current, top: height }));
          }}
        >
          <Text style={styles.title} numberOfLines={1}>
            {tree.name}
          </Text>
          {tracing === null ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setTracing({ kind: null, anchor: null })}
              style={({ pressed }) => [styles.trace, pressed && styles.pressed]}
            >
              <Text style={styles.traceLabel}>Tracer un lien</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>
        </View>

        <View
          style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setChrome((current) => ({ ...current, bottom: height }));
          }}
        >
          {tracing !== null && bond === null ? (
            <View style={styles.choice}>
              <View style={styles.banner}>
                <Text style={styles.bannerText}>Quel lien voulez-vous tracer ?</Text>
                <InkButton
                  label="Annuler"
                  variant="quiet"
                  onPress={() => setTracing(null)}
                />
              </View>
              <View style={styles.tools}>
                <InkButton
                  label="Couple"
                  variant="tonal"
                  grow
                  onPress={() => setTracing({ kind: "couple", anchor: null })}
                />
                <InkButton
                  label="Descendance"
                  variant="tonal"
                  grow
                  onPress={() => setTracing({ kind: "descent", anchor: null })}
                />
              </View>
            </View>
          ) : tracing !== null && bond !== null ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText} numberOfLines={3}>
                {anchor === null ? (
                  bond === "couple" ? (
                    "Touchez l'un des deux conjoints."
                  ) : (
                    "Touchez le parent."
                  )
                ) : (
                  <>
                    {bond === "couple" ? "Touchez qui est uni à " : "Touchez les enfants de "}
                    <Text style={styles.bannerName}>
                      {byId.get(anchor.characterId)?.name ?? "ce personnage"}
                    </Text>
                    {bond === "couple"
                      ? ", sur la même ligne. À nouveau pour effacer le trait."
                      : ", sur la ligne du dessous. À nouveau pour effacer un trait."}
                  </>
                )}
              </Text>
              <InkButton
                label="Terminé"
                variant="solid"
                onPress={() => setTracing(null)}
              />
            </View>
          ) : (
            <View style={styles.tools}>
              <InkButton
                label="Renommer"
                variant="tonal"
                grow
                onPress={() =>
                  Alert.prompt?.(
                    "Renommer l'arbre",
                    undefined,
                    (name?: string) => {
                      if (name && name.trim() !== "") {
                        run(renameTree(tree.id, name));
                      }
                    },
                    "plain-text",
                    tree.name,
                  )
                }
              />
              <InkButton
                label="Supprimer"
                variant="quiet"
                tone="wax"
                grow
                onPress={() =>
                  Alert.alert(
                    `Supprimer « ${tree.name} » ?`,
                    "Les personnages restent dans la collection ; seul l'arbre disparaît.",
                    [
                      { text: "Annuler", style: "cancel" },
                      {
                        text: "Supprimer",
                        style: "destructive",
                        onPress: () => run(removeTree(tree.id).then(onClose)),
                      },
                    ],
                  )
                }
              />
            </View>
          )}
        </View>

        {/* The picker for "add someone to generation N". Its own field is never
            shown — the slot on the canvas is the trigger. */}
        <SelectField
          title={
            adding !== null && rowCount(tree, adding) === 0
              ? "Ajouter une génération"
              : "Ajouter à cette génération"
          }
          placeholder=""
          options={characters
            .filter(
              (person) =>
                !tree.members.some((member) => member.characterId === person.id),
            )
            .map((person) => {
              const dates = lifespan(person);
              return {
                value: person.id,
                label: dates === "" ? person.name : `${person.name} · ${dates}`,
              };
            })}
          selected={[]}
          single
          onToggle={(characterId) => {
            if (adding === null) return;
            run(addToTree(tree.id, characterId, adding));
            setAdding(null);
          }}
          emptyMessage="Tout le monde est déjà dans cet arbre — ou il n'y a personne à y mettre."
          onClose={() => setAdding(null)}
          trigger={(openPicker) => (
            <Opener open={openPicker} when={adding !== null} />
          )}
        />

        <TreeMemberSheet
          key={open?.id ?? "none"}
          tree={tree}
          member={open}
          person={open ? byId.get(open.characterId) : undefined}
          onClose={() => setOpenId(null)}
        />
      </View>
    </Modal>
  );
}

/**
 * Opens the picker when the canvas asks, and renders nothing.
 *
 * `SelectField` owns the sheet and the list; all this needs is a way in that
 * is not a grey field sitting in the middle of a drawing. In an effect and not
 * during the render: calling the parent's setter while rendering a child is
 * exactly the update-during-render React refuses.
 */
function Opener({ open, when }: { open: () => void; when: boolean }) {
  useEffect(() => {
    if (when) open();
    // `open` is rebuilt every render; following it would reopen endlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when]);
  return null;
}

const SLOT = 72;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.paper },
  line: { position: "absolute", backgroundColor: palette.inkSoft },
  slot: {
    position: "absolute",
    width: SLOT,
    height: SLOT,
    // Placed from the corner of a node box, then nudged onto the portrait
    // axis: the `+` belongs on the same line as the faces of its generation.
    marginLeft: (NODE.width - SLOT) / 2,
    marginTop: FACE_AXIS - SLOT / 2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: SLOT / 2,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.inkFaint,
  },
  slotGlyph: { fontSize: 24, lineHeight: 28, color: palette.inkSoft },
  pressed: { opacity: 0.55 },

  top: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    backgroundColor: palette.paperLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  title: { flex: 1, ...type.heading, fontWeight: "700", color: palette.ink },
  trace: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: palette.sunken,
  },
  traceLabel: { ...type.caption, fontWeight: "700", color: palette.ink },
  close: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  closeGlyph: { fontSize: 26, lineHeight: 30, color: palette.ink, marginTop: -2 },

  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: palette.paperLight,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    ...shadow.lifted,
  },
  tools: { flexDirection: "row", alignItems: "center", gap: space.sm },
  choice: { gap: space.sm },
  /** Dimmed as a node is, so "not now" looks the same everywhere. */
  away: { opacity: 0.25 },
  banner: { flexDirection: "row", alignItems: "center", gap: space.md },
  bannerText: { flex: 1, ...type.caption, color: palette.inkSoft },
  bannerName: { color: palette.ink, fontWeight: "700" },
});
