import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { generationCount } from "./layout";
import { TreeBuilder } from "./TreeBuilder";
import {
  InkButton,
  InkField,
  Roster,
  RosterEmpty,
  RosterRow,
  Sheet,
  useNotice,
} from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import type { Tree } from "../events/types";
import { palette } from "../../theme/palette";
import { space } from "../../theme/tokens";

/**
 * The genealogies, listed.
 *
 * The same shape as the characters' half, and deliberately: a slot at the top
 * of the list opens a sheet, the sheet asks for the one thing a tree needs — a
 * name — and the list below is the index. A tree is made in a word and built
 * afterwards, full screen, where there is room to arrange it.
 */
export function TreeManager() {
  const { trees, characters, addTree } = useEvents();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const { say, dialog } = useNotice();
  const [open, setOpen] = useState<string | null>(null);
  /**
   * A tree made but not yet shown.
   *
   * The builder is a modal and the naming sheet is another; iOS refuses to
   * present one while dismissing the other, so the new tree waits here until
   * the sheet has finished leaving.
   */
  const [pending, setPending] = useState<string | null>(null);

  const create = async () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    setCreating(true);
    try {
      const tree = await addTree(trimmed);
      setName("");
      setPending(tree.id);
      setNaming(false);
    } catch (cause) {
      say(
        "Arbre non créé",
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setCreating(false);
    }
  };

  const shown = trees.find((tree) => tree.id === open) ?? null;

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      {dialog}

      <Roster
        count={
          trees.length === 0
            ? "Aucun arbre"
            : `${trees.length} arbre${trees.length > 1 ? "s" : ""}`
        }
        addLabel="Nouvel arbre"
        onAdd={() => {
          setName("");
          setNaming(true);
        }}
      >
        {trees.length === 0 ? (
          <RosterEmpty>
            {characters.length === 0
              ? "Créez d'abord des personnages : un arbre se bâtit avec eux."
              : "Un arbre relie des personnages entre eux, génération par génération."}
          </RosterEmpty>
        ) : (
          trees.map((tree) => (
            <RosterRow
              key={tree.id}
              thumb={<Text style={styles.glyph}>⚘</Text>}
              title={tree.name}
              detail={summarise(tree)}
              onPress={() => setOpen(tree.id)}
            />
          ))
        )}
      </Roster>

      <Sheet
        visible={naming}
        onClose={() => setNaming(false)}
        onClosed={() => {
          if (pending === null) return;
          setOpen(pending);
          setPending(null);
        }}
        title="Nouvel arbre"
        footer={
          <>
            <InkButton
              label="Annuler"
              variant="tonal"
              grow
              onPress={() => setNaming(false)}
            />
            <InkButton
              label={creating ? "Création…" : "Créer"}
              variant="solid"
              grow
              disabled={creating || name.trim() === ""}
              onPress={() => void create()}
            />
          </>
        }
      >
        <View style={styles.form}>
          <InkField
            label="Nom de l'arbre"
            value={name}
            onChangeText={setName}
            placeholder="Les Capétiens"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void create()}
          />
        </View>
      </Sheet>

      <TreeBuilder tree={shown} onClose={() => setOpen(null)} />
    </ScrollView>
  );
}

function summarise(tree: Tree): string {
  if (tree.members.length === 0) return "vide";
  const people = `${tree.members.length} personnage${tree.members.length > 1 ? "s" : ""}`;
  const rows = generationCount(tree);
  const lines = tree.links.length;
  return [
    people,
    `${rows} génération${rows > 1 ? "s" : ""}`,
    lines === 0 ? null : `${lines} lien${lines > 1 ? "s" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  form: { paddingHorizontal: space.xl, paddingBottom: space.lg },
  /** A sprig, for want of a portrait: a tree has no face of its own. */
  glyph: { fontSize: 20, color: palette.inkFaint },
});
