import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  canvasSize,
  columnX,
  connectors,
  FACE_AXIS,
  frame,
  nextColumn,
  NODE,
  place,
  rowCount,
  rowY,
  span,
} from "./layout";
import { LinkChoice, type LinkMode } from "./LinkChoice";
import { PanZoom } from "./PanZoom";
import { dropAt, lineBetween, spouses, tied } from "../events/rows";
import { TreeMemberSheet } from "./TreeMemberSheet";
import { TreeNode } from "./TreeNode";
import {
  Dialog,
  InkButton,
  InkField,
  SelectField,
  useNotice,
} from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { lifespan } from "../events/lifespan";
import type { Tree, TreeMember } from "../events/types";
import { palette } from "../../theme/palette";
import { radius, shadow, space, TOUCH, type } from "../../theme/tokens";

/**
 * What the canvas is being used for, and who is held while it happens.
 *
 * `chosen` is a list because a descent may be claimed by two parents at once —
 * the first touched, and their spouse if they are touched next. The other two
 * modes never hold more than one person.
 */
type Tracing = { mode: LinkMode; chosen: string[] };

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
 * erases the line. On a descent the spouse of the first person may be touched
 * too, and the children then belong to the couple. Only the members that can
 * legally take that link stay lit, so the rule is shown rather than explained
 * and there is no wrong move to refuse. No dragging, no hidden gesture; the bar
 * at the foot says where you are and how to leave.
 */
export function TreeBuilder({ tree, onClose }: TreeBuilderProps) {
  const insets = useSafeAreaInsets();
  const {
    characters,
    addToTree,
    eraseLink,
    linkInTree,
    orderRow,
    removeTree,
    renameTree,
  } = useEvents();

  const [openId, setOpenId] = useState<string | null>(null);
  /** Which face the ··· card is showing, if it is open at all. */
  const [menu, setMenu] = useState<"menu" | "rename" | "delete" | null>(null);
  /** The new name being typed on the card's second face. */
  const [name, setName] = useState("");
  const { say, dialog } = useNotice();
  /** The dialogue asking what the next taps will do. */
  const [choosing, setChoosing] = useState(false);
  /** What they are doing, once it has been answered. */
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

  /**
   * Shared with the window behind and with every card: one says "a card is
   * loose, keep your hands off", the other says how far the drawing is
   * zoomed. Refs rather than state, because both are read inside gesture
   * responders that are built once and never see a new render.
   */
  const dragging = useRef(false);
  const magnification = useRef(1);

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
  const columns = span(tree);
  const byId = new Map(characters.map((person) => [person.id, person]));
  const open = tree.members.find((member) => member.id === openId) ?? null;
  const mode = tracing?.mode ?? null;
  const held = (tracing?.chosen ?? []).flatMap((id) => {
    const member = tree.members.find((one) => one.id === id);
    return member ? [member] : [];
  });
  const anchor = held[0] ?? null;

  /**
   * Who the held members are already joined to — ringed in wax.
   *
   * In the two drawing modes this marks what is done and needs no second
   * thought; while erasing it marks what can be taken away.
   */
  const attached = new Set<string>();
  if (anchor && mode) {
    for (const link of tree.links) {
      // A couple has no direction, so the row may have been written either way
      // round; a descent read backwards would put a child above its parent.
      const facing =
        link.from === anchor.id
          ? link.to
          : link.to === anchor.id && link.kind === "couple"
            ? link.from
            : null;

      if (mode === "erase") {
        if (link.from === anchor.id) attached.add(link.to);
        else if (link.to === anchor.id) attached.add(link.from);
      } else if (link.kind !== mode) continue;
      // A child counts as attached only once every chosen parent claims it;
      // touching it otherwise finishes the family rather than undoing it.
      else if (mode === "descent") {
        if (held.every((one) => hasLine(tree, one.id, link.to))) attached.add(link.to);
      } else if (facing) attached.add(facing);
    }
  }

  /**
   * Whether this member may take the line being drawn.
   *
   * The whole rule of the feature: a couple runs along a row and joins two
   * people and no more; a descent runs into the row below, and may be claimed
   * by the first person's spouse as well; an erasure reaches only where a line
   * already runs. Everyone else is dimmed, which is why nothing here ever has
   * to refuse a tap with an alert.
   */
  const reachable = (member: TreeMember): boolean => {
    if (!mode) return false;

    if (mode === "erase") {
      // Only those holding something to give up, then only the other end of
      // one of their lines.
      if (!anchor) return tied(tree, member.id);
      return (
        member.id === anchor.id ||
        lineBetween(tree, anchor.id, member.id) !== undefined
      );
    }

    if (!anchor || member.id === anchor.id) return true;

    if (mode === "descent") {
      if (member.generation === anchor.generation + 1) return true;
      // The spouse, to give the children two parents. Only the anchor's, so
      // the second parent is never someone else's husband.
      return spouses(tree, anchor.id).includes(member.id);
    }

    if (member.generation !== anchor.generation) return false;
    if (spouses(tree, anchor.id).includes(member.id)) return true;
    // Two to a couple: neither may already be married, or the bar would run
    // through a row that can no longer be kept in order.
    return (
      spouses(tree, anchor.id).length === 0 && spouses(tree, member.id).length === 0
    );
  };

  const run = (work: Promise<unknown>) => {
    setBusy(true);
    void work
      .catch((cause: unknown) =>
        say(
          "Modification impossible",
          cause instanceof Error ? cause.message : String(cause),
        ),
      )
      .finally(() => setBusy(false));
  };

  const rename = () => {
    const wanted = name.trim();
    if (wanted === "" || wanted === tree.name) {
      setMenu(null);
      return;
    }
    setMenu(null);
    run(renameTree(tree.id, wanted));
  };

  const tap = (member: TreeMember) => {
    if (!tracing) {
      setOpenId(member.id);
      return;
    }
    if (!mode || !reachable(member)) return;
    if (!anchor) {
      setTracing({ mode, chosen: [member.id] });
      return;
    }
    // Touching someone already held lets go of them, so a mis-tap costs one
    // tap rather than a trip out of the mode and back in.
    if (held.some((one) => one.id === member.id)) {
      setTracing({ mode, chosen: tracing.chosen.filter((id) => id !== member.id) });
      return;
    }

    if (mode === "erase") {
      run(eraseLink(tree.id, anchor.id, member.id));
      return;
    }
    // The spouse joins the parents rather than becoming a child: same row.
    if (mode === "descent" && member.generation === anchor.generation) {
      setTracing({ mode, chosen: [...tracing.chosen, member.id] });
      return;
    }
    // Already joined, and nothing here undoes that any more — erasing is its
    // own mode, and one that says out loud what else it takes with it.
    if (attached.has(member.id)) return;

    run(
      (async () => {
        for (const parent of mode === "descent" ? held : [anchor]) {
          // A parent that already claims this child is left alone, so adding a
          // second parent does not undo the first one's line.
          if (hasLine(tree, parent.id, member.id)) continue;
          await linkInTree(tree.id, mode, parent.id, member.id, true);
        }
      })(),
    );
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <PanZoom
          held={dragging}
          magnification={magnification}
          content={size}
          // The foot of the screen is only occupied while a line is being
          // drawn; the rest of the time the canvas may use it.
          inset={{ top: chrome.top, bottom: tracing === null ? 0 : chrome.bottom }}
          subject={tree.id}
        >
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
              (held.some((one) => one.id === node.member.id) ||
                attached.has(node.member.id))
            }
            muted={tracing !== null && !reachable(node.member)}
            onPress={() => tap(node.member)}
            // Not while a line is being traced: the canvas means something
            // else then, and every tap belongs to that.
            drag={
              tracing === null
                ? {
                    held: dragging,
                    magnification,
                    onStart: () => setOpenId(null),
                    onDrop: (columns) => {
                      if (columns === 0) return;
                      const moves = dropAt(
                        tree,
                        node.member,
                        node.member.position + columns,
                      );
                      if (moves.length > 0) run(orderRow(tree.id, moves));
                    },
                  }
                : undefined
            }
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
                left: columnX(nextColumn(tree, generation), columns),
                top: rowY(generation, rows),
              },
            ]}
          >
            <Text style={styles.slotGlyph}>+</Text>
          </Pressable>
        ))}
        </PanZoom>

        {/* Header and the button under it are measured together: what the
            canvas must stay clear of is the whole of it. */}
        <View
          style={styles.top}
          // Read before the updater runs: a functional setState is called on
          // the next render, by which time React Native has recycled the
          // synthetic event and nulled its `nativeEvent`.
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setChrome((current) => ({ ...current, top: height }));
          }}
        >
          <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
            >
              <Text style={styles.backGlyph}>‹</Text>
            </Pressable>
            {/* Centred by the two equal side buttons, not by guesswork: the
                title takes what is left and prints in the middle of it. */}
            <Text style={styles.title} numberOfLines={1}>
              {tree.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Options de l'arbre"
              hitSlop={8}
              onPress={() => setMenu("menu")}
              style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
            >
              <Text style={styles.moreGlyph}>···</Text>
            </Pressable>
          </View>

          {tracing === null ? (
            <View style={styles.underBar}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setChoosing(true)}
                style={({ pressed }) => [styles.trace, pressed && styles.pressed]}
              >
                <Text style={styles.traceLabel}>Modifier les liens</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Only while a line is being drawn. The rest of the time the tree
            has the whole screen, and what used to live down here — renaming,
            deleting — is behind the ··· in the header. */}
        {tracing !== null && mode !== null ? (
          <View
            style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}
            onLayout={(event) => {
              const { height } = event.nativeEvent.layout;
              setChrome((current) => ({ ...current, bottom: height }));
            }}
          >
            <View style={styles.banner}>
              <Text style={styles.bannerText} numberOfLines={3}>
                {anchor === null ? (
                  mode === "couple" ? (
                    "Touchez l'un des deux conjoints."
                  ) : mode === "descent" ? (
                    "Touchez le parent."
                  ) : (
                    "Touchez le personnage dont un lien doit disparaître."
                  )
                ) : (
                  <>
                    {mode === "couple"
                      ? "Touchez qui est uni à "
                      : mode === "descent"
                        ? "Touchez les enfants de "
                        : "Touchez qui détacher de "}
                    <Text style={styles.bannerName}>
                      {held
                        .map(
                          (one) =>
                            byId.get(one.characterId)?.name ?? "ce personnage",
                        )
                        .join(" et ")}
                    </Text>
                    {mode === "couple"
                      ? ", sur la même ligne."
                      : mode === "erase"
                        ? ". Ce qui dépendait de ce lien s'efface avec lui."
                        : held.length > 1
                          ? ", sur la ligne du dessous."
                          : ", sur la ligne du dessous — ou son conjoint, pour une descendance commune."}
                  </>
                )}
              </Text>
              <InkButton
                label="Terminé"
                variant="solid"
                onPress={() => setTracing(null)}
              />
            </View>
          </View>
        ) : null}

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
            // Someone may stand twice on one row — a man is drawn once beside
            // each of his wives — but never on two, which would make him his
            // own ancestor. So only the other generations rule a name out.
            .filter(
              (person) =>
                !tree.members.some(
                  (member) =>
                    member.characterId === person.id &&
                    member.generation !== adding,
                ),
            )
            .map((person) => {
              const dates = lifespan(person);
              const again = tree.members.some(
                (member) => member.characterId === person.id,
              );
              const said = dates === "" ? person.name : `${person.name} · ${dates}`;
              return {
                value: person.id,
                label: again ? `${said} · encore une fois` : said,
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

        {/* One card, three faces — the menu, the new name, the confirmation.
            Never a second card over the first: iOS refuses to present a modal
            from a controller already presenting one, and the button that opened
            it would appear to do nothing at all. */}
        <Dialog
          visible={menu !== null}
          onClose={() => setMenu(null)}
          title={
            menu === "rename"
              ? "Renommer l'arbre"
              : menu === "delete"
                ? `Supprimer « ${tree.name} » ?`
                : tree.name
          }
          hint={
            menu === "delete"
              ? "Les personnages restent dans la collection ; seul l'arbre disparaît."
              : undefined
          }
          dismissLabel={menu === "menu" ? null : "Retour"}
          onDismiss={() => setMenu("menu")}
        >
          {menu === "rename" ? (
            <>
              <InkField
                label="Nom de l'arbre"
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => rename()}
              />
              <InkButton
                label="Renommer"
                variant="solid"
                disabled={busy || name.trim() === ""}
                onPress={rename}
              />
            </>
          ) : menu === "delete" ? (
            <InkButton
              label="Supprimer"
              variant="solid"
              tone="danger"
              disabled={busy}
              onPress={() => {
                setMenu(null);
                run(removeTree(tree.id).then(onClose));
              }}
            />
          ) : (
            <>
              <InkButton
                label="Renommer"
                variant="tonal"
                onPress={() => {
                  setName(tree.name);
                  setMenu("rename");
                }}
              />
              <InkButton
                label="Supprimer l'arbre"
                variant="solid"
                tone="danger"
                onPress={() => setMenu("delete")}
              />
            </>
          )}
        </Dialog>

        {dialog}

        <LinkChoice
          visible={choosing}
          onChoose={(mode) => {
            setChoosing(false);
            setTracing({ mode, chosen: [] });
          }}
          onClose={() => setChoosing(false)}
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

/** Does this member already claim that one as their child? */
function hasLine(tree: Tree, parentId: string, childId: string): boolean {
  return tree.links.some(
    (link) =>
      link.kind === "descent" && link.from === parentId && link.to === childId,
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

  top: { position: "absolute", left: 0, right: 0, top: 0 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    backgroundColor: palette.paperLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  /** Loose on the canvas under the header, not part of it. */
  underBar: {
    alignItems: "flex-end",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  title: {
    flex: 1,
    ...type.heading,
    fontWeight: "700",
    color: palette.ink,
    textAlign: "center",
  },
  // In wax, like the year in the frieze: the colour this app keeps for the
  // thing you are about to act on.
  trace: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
    ...shadow.soft,
  },
  traceLabel: {
    ...type.caption,
    fontWeight: "700",
    color: palette.paperLight,
  },
  icon: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  backGlyph: { fontSize: 34, lineHeight: 38, color: palette.ink, marginTop: -4 },
  moreGlyph: { fontSize: 22, lineHeight: 26, color: palette.ink, marginTop: -6 },

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
  /** Dimmed as a node is, so "not now" looks the same everywhere. */
  away: { opacity: 0.25 },
  banner: { flexDirection: "row", alignItems: "center", gap: space.md },
  bannerText: { flex: 1, ...type.caption, color: palette.inkSoft },
  bannerName: { color: palette.ink, fontWeight: "700" },
});
