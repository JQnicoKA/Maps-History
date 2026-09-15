import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  canvasSize,
  columnX,
  connectors,
  frame,
  NODE,
  place,
  rowCount,
  rowY,
} from "./layout";
import { TreeMemberSheet } from "./TreeMemberSheet";
import { TreeNode } from "./TreeNode";
import { InkButton, SelectField } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { lifespan } from "../events/lifespan";
import type { Tree, TreeMember } from "../events/types";
import { palette } from "../../theme/palette";
import { radius, shadow, space, TOUCH, type } from "../../theme/tokens";

export type TreeBuilderProps = {
  tree: Tree | null;
  onClose: () => void;
};

/**
 * The tree, and the tools to build it.
 *
 * Full screen, not a bottom sheet: a genealogy is wide and deep by nature, and
 * arranging one through a letterbox would be a punishment. The canvas scrolls
 * in both directions and the chrome floats over it.
 *
 * Two modes, and only two. Normally a tap opens someone's card. In **linking**
 * mode — entered from that card — a tap adds or removes a line from the chosen
 * parent to whoever is tapped. That is the whole interaction: no dragging, no
 * hidden gesture, and the banner says which mode you are in and how to leave.
 */
export function TreeBuilder({ tree, onClose }: TreeBuilderProps) {
  const insets = useSafeAreaInsets();
  const { characters, addToTree, linkInTree, removeTree, renameTree } = useEvents();

  const [openId, setOpenId] = useState<string | null>(null);
  /** The parent whose children are being chosen, if any. */
  const [linking, setLinking] = useState<string | null>(null);
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
  const parent = tree.members.find((member) => member.id === linking) ?? null;

  const childrenOf = (id: string) =>
    new Set(
      tree.links.filter((link) => link.parentId === id).map((link) => link.childId),
    );
  const linked = parent ? childrenOf(parent.id) : new Set<string>();

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
    if (!parent) {
      setOpenId(member.id);
      return;
    }
    if (member.id === parent.id) return;
    // A line only ever runs downwards; anything else is a mistake worth
    // refusing plainly rather than drawing and letting the reader wonder.
    if (member.generation <= parent.generation) {
      Alert.alert(
        "Pas dans ce sens",
        "Un enfant se place dans une génération plus basse que son parent.",
      );
      return;
    }
    run(linkInTree(tree.id, parent.id, member.id, !linked.has(member.id)));
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView style={styles.canvas}>
          <ScrollView horizontal contentContainerStyle={{ minWidth: size.width }}>
            {/* The bars float over the canvas, so the drawing is inset by
                their height — otherwise the first generation sits under the
                title and cannot even be tapped. */}
            <View
              style={{
                paddingTop: chrome.top,
                paddingBottom: chrome.bottom,
              }}
            >
              <View style={{ width: size.width, height: size.height }}>
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
                      parent
                        ? node.member.id === parent.id ||
                          linked.has(node.member.id)
                        : false
                    }
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
                    disabled={busy || parent !== null}
                    onPress={() => setAdding(generation)}
                    style={({ pressed }) => [
                      styles.slot,
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
              </View>
            </View>
          </ScrollView>
        </ScrollView>

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
          {parent ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText} numberOfLines={2}>
                Touchez les enfants de{" "}
                <Text style={styles.bannerName}>
                  {byId.get(parent.characterId)?.name ?? "ce personnage"}
                </Text>
                . Touchez à nouveau pour effacer un trait.
              </Text>
              <InkButton
                label="Terminé"
                variant="solid"
                onPress={() => setLinking(null)}
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
          onStartLinking={() => {
            setLinking(open?.id ?? null);
            setOpenId(null);
          }}
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
  canvas: { flex: 1 },
  line: { position: "absolute", backgroundColor: palette.inkSoft },
  slot: {
    position: "absolute",
    width: SLOT,
    height: SLOT,
    marginLeft: (NODE.width - SLOT) / 2,
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
  banner: { flexDirection: "row", alignItems: "center", gap: space.md },
  bannerText: { flex: 1, ...type.caption, color: palette.inkSoft },
  bannerName: { color: palette.ink, fontWeight: "700" },
});
