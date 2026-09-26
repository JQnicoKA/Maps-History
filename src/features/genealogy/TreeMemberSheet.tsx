import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  ConfirmDialog,
  InkButton,
  InkField,
  SegmentedControl,
  Sheet,
  useNotice,
} from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { lifespan } from "../events/lifespan";
import { blockOf, blocks, slide } from "../events/rows";
import {
  type Character,
  type Importance,
  type Tree,
  type TreeMember,
} from "../events/types";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

/** "1 conjoint · 3 enfants", or what is left of it. */
function describeTies({ children, spouses }: { children: number; spouses: number }): string {
  const said: string[] = [];
  if (spouses > 0) said.push(`${spouses} conjoint${spouses > 1 ? "s" : ""}`);
  if (children > 0) said.push(`${children} enfant${children > 1 ? "s" : ""}`);
  return said.length === 0 ? "Aucun lien tracé" : said.join(" · ");
}

const IMPORTANCES: { value: Importance; label: string }[] = [
  { value: "low", label: "Discret" },
  { value: "medium", label: "Normal" },
  { value: "high", label: "Majeur" },
];

export type TreeMemberSheetProps = {
  tree: Tree;
  member: TreeMember | null;
  person: Character | undefined;
  onClose: () => void;
};

/**
 * What can be said about someone's place in a tree.
 *
 * All of it belongs to the placement rather than to the person — the weight,
 * the note, the rank in the row. Editing a life is a different sheet,
 * reached from the Personnage half.
 */
export function TreeMemberSheet({
  tree,
  member,
  person,
  onClose,
}: TreeMemberSheetProps) {
  const { editTreeMember, orderRow, removeFromTree } = useEvents();
  const [note, setNote] = useState(member?.note ?? "");
  const [busy, setBusy] = useState(false);
  /** The confirmation before this member leaves the tree. */
  const [leaving, setLeaving] = useState(false);
  const { say, dialog } = useNotice();

  if (!member) return null;

  const run = (work: Promise<void>) => {
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

  /**
   * The row as blocks — a couple counts as one — and this member's two steps.
   *
   * A step means one of two things now: a spouse changes places inside their
   * own couple, or, standing at its edge, carries the whole couple over the
   * neighbouring block. Either way nobody ends up between two spouses.
   */
  const order = blocks(tree, member.generation);
  const married = (order[blockOf(tree, member)]?.length ?? 1) > 1;
  // Asked of the rule itself rather than worked out here: whether a step is
  // possible and what it costs are the same question, and one answer cannot
  // then disagree with the other.
  const step = { left: slide(tree, member, -1), right: slide(tree, member, 1) };

  const shift = (by: -1 | 1) => {
    const moves = by === -1 ? step.left : step.right;
    if (moves.length > 0) run(orderRow(tree.id, moves));
  };

  /**
   * What this member is tied to, counted for the reader.
   *
   * Shown and not edited here: lines are drawn on the canvas, where both ends
   * can be seen at once, which a sheet covering half the tree cannot offer.
   */
  const ties = { children: 0, spouses: 0 };
  for (const link of tree.links) {
    if (link.kind === "descent") {
      // Only downwards: a member's own parents are someone else's children.
      if (link.from === member.id) ties.children += 1;
    } else if (link.from === member.id || link.to === member.id) {
      ties.spouses += 1;
    }
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      title={person?.name ?? "Personnage"}
      footer={
        <>
          <InkButton
            label="Retirer"
            variant="solid"
            tone="danger"
            grow
            disabled={busy}
            onPress={() => setLeaving(true)}
          />
          <InkButton
            label="Terminé"
            variant="solid"
            grow
            disabled={busy}
            onPress={() => {
              if (note !== (member.note ?? "")) {
                run(editTreeMember(tree.id, member.id, { note }).then(onClose));
                return;
              }
              onClose();
            }}
          />
        </>
      }
    >
      {dialog}

      <ConfirmDialog
        visible={leaving}
        title="Retirer de l'arbre ?"
        message="Le personnage reste dans la collection ; seules sa place ici et ses lignes disparaissent."
        confirmLabel="Retirer"
        onConfirm={() => {
          setLeaving(false);
          run(removeFromTree(tree.id, member.id).then(onClose));
        }}
        onClose={() => setLeaving(false)}
      />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {person && lifespan(person) !== "" ? (
          <Text style={styles.dates}>{lifespan(person)}</Text>
        ) : null}
        <Text style={styles.ties}>{describeTies(ties)}</Text>

        <View style={styles.section}>
          <Text style={styles.legend}>Place dans la généalogie</Text>
          <SegmentedControl
            segments={IMPORTANCES}
            value={member.importance}
            onChange={(importance) =>
              run(editTreeMember(tree.id, member.id, { importance }))
            }
          />
          <Text style={styles.hint}>
            Un personnage discret est dessiné plus effacé, un majeur plus net.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.legend}>Rang dans la génération</Text>
          <View style={styles.shiftRow}>
            <InkButton
              label="‹  Gauche"
              grow
              disabled={busy || step.left.length === 0}
              onPress={() => shift(-1)}
            />
            <InkButton
              label="Droite  ›"
              grow
              disabled={busy || step.right.length === 0}
              onPress={() => shift(1)}
            />
          </View>
          <Text style={styles.hint}>
            {married
              ? "Au sein de son couple il échange sa place ; au bord, c'est tout le couple qui se déplace. Rien ne borne la ligne : on peut l'écarter dans le vide pour l'amener sous ses parents."
              : "Rien ne borne la ligne : on peut l'écarter dans le vide pour l'amener sous ses parents."}
          </Text>
        </View>

        <InkField
          label="À propos de lui dans cet arbre"
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Ce qui le rattache à cette lignée…"
        />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  dates: { ...type.body, color: palette.inkSoft, textAlign: "center" },
  ties: { ...type.caption, color: palette.inkFaint, textAlign: "center" },
  section: { gap: space.sm },
  legend: { ...type.legend, color: palette.inkSoft },
  hint: { ...type.caption, color: palette.inkFaint },
  shiftRow: { flexDirection: "row", gap: space.sm },
});
