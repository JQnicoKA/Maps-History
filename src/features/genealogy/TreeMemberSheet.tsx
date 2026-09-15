import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  InkButton,
  InkField,
  SegmentedControl,
  Sheet,
} from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { lifespan } from "../events/lifespan";
import {
  type Character,
  type Importance,
  type Tree,
  type TreeMember,
} from "../events/types";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

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
  /** Enters the mode where the next taps choose this member's children. */
  onStartLinking: () => void;
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
  onStartLinking,
}: TreeMemberSheetProps) {
  const { editTreeMember, removeFromTree } = useEvents();
  const [note, setNote] = useState(member?.note ?? "");
  const [busy, setBusy] = useState(false);

  if (!member) return null;

  const run = (work: Promise<void>) => {
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

  const siblings = tree.members.filter(
    (one) => one.generation === member.generation,
  );
  const rank = siblings.findIndex((one) => one.id === member.id);

  /** Swaps ranks with the neighbour, which is all "move left" can mean here. */
  const shift = (by: -1 | 1) => {
    const other = siblings[rank + by];
    if (!other) return;
    run(
      (async () => {
        await editTreeMember(tree.id, member.id, { position: other.position });
        await editTreeMember(tree.id, other.id, { position: member.position });
      })(),
    );
  };

  const children = tree.links.filter((link) => link.parentId === member.id).length;

  return (
    <Sheet
      visible
      onClose={onClose}
      title={person?.name ?? "Personnage"}
      footer={
        <>
          <InkButton
            label="Retirer"
            variant="quiet"
            tone="wax"
            grow
            disabled={busy}
            onPress={() =>
              Alert.alert(
                "Retirer de l'arbre ?",
                "Le personnage reste dans la collection ; seules sa place ici et ses lignes disparaissent.",
                [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Retirer",
                    style: "destructive",
                    onPress: () => {
                      run(removeFromTree(tree.id, member.id).then(onClose));
                    },
                  },
                ],
              )
            }
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
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {person && lifespan(person) !== "" ? (
          <Text style={styles.dates}>{lifespan(person)}</Text>
        ) : null}

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
            Un personnage discret est dessiné plus petit, un majeur plus grand.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.legend}>Rang dans la génération</Text>
          <View style={styles.shiftRow}>
            <InkButton
              label="‹  Gauche"
              grow
              disabled={busy || rank <= 0}
              onPress={() => shift(-1)}
            />
            <InkButton
              label="Droite  ›"
              grow
              disabled={busy || rank < 0 || rank >= siblings.length - 1}
              onPress={() => shift(1)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.legend}>Descendance</Text>
          <InkButton
            label={
              children === 0
                ? "Tracer vers ses enfants"
                : `Tracer vers ses enfants · ${children} tracé${children > 1 ? "s" : ""}`
            }
            variant="tonal"
            onPress={onStartLinking}
          />
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
  section: { gap: space.sm },
  legend: { ...type.legend, color: palette.inkSoft },
  hint: { ...type.caption, color: palette.inkFaint },
  shiftRow: { flexDirection: "row", gap: space.sm },
});
