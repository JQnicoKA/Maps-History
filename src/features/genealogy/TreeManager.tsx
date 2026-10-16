import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { generationCount } from "./layout";
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
import { space, type } from "../../theme/tokens";

/**
 * The genealogies, listed.
 *
 * The same shape as the characters' half, and deliberately: a slot at the top
 * of the list opens a sheet, the sheet asks for the one thing a tree needs — a
 * name — and the list below is the index. A tree is made in a word and built
 * afterwards, full screen, where there is room to arrange it.
 *
 * The drawing is not opened here but asked for. It is full screen and it now
 * carries pages of its own — a person's card, and the ways out of it — so it
 * belongs at the top of the screen, where nothing it opens has to be a panel
 * inside a panel inside a panel.
 */
export type TreeManagerProps = {
  /** Asks for a tree to be drawn. */
  onOpen: (id: string) => void;
  /** Asks for the community's genealogies. */
  onSeek: () => void;
};

export function TreeManager({ onOpen, onSeek }: TreeManagerProps) {
  const { trees, characters, addTree } = useEvents();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const { say, dialog } = useNotice();

  const create = async () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    setCreating(true);
    try {
      const tree = await addTree(trimmed);
      setName("");
      setNaming(false);
      // Straight to the drawing: a tree made and left in a list is a tree
      // nobody builds. The screen lowers both sheets before raising it.
      onOpen(tree.id);
    } catch (cause) {
      say(
        "Arbre non créé",
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      {dialog}

      {/* Ce qu'est un arbre, dit avant la liste.
          Trois lignes et non un premier écran à franchir : le résumé se lit
          une fois et la liste se consulte cent fois, donc il se pose au-dessus
          plutôt que devant. Dans le défilement, pour qu'il s'écarte dès qu'on
          travaille au lieu de manger une hauteur fixe. */}
      <View style={styles.preface}>
        <Text style={styles.prefaceText}>
          Un arbre relie vos personnages entre eux, génération par génération
        </Text>
        <View style={styles.rule} />
      </View>

      <Roster
        count={
          trees.length === 0
            ? "Aucun arbre"
            : `${trees.length} arbre${trees.length > 1 ? "s" : ""}`
        }
        addLabel="Nouvel arbre"
        seekLabel="Chercher dans la bibliothèque"
        seekDetail="Les arbres de la communauté"
        onSeek={onSeek}
        onAdd={() => {
          setName("");
          setNaming(true);
        }}
      >
        {/* Rien quand la liste est vide : ce qu'un arbre est, la préface
            ci-dessus le dit déjà, et le redire sous l'emplacement vide ne
            serait que la même phrase deux fois sur un écran.

            Une exception, et c'est un renseignement et non une définition :
            sans personnages, on ne peut rien bâtir du tout. Celui-là, la
            préface ne le dit pas. */}
        {trees.length === 0 ? (
          characters.length === 0 ? (
            <RosterEmpty>
              Créez d'abord des personnages : un arbre se bâtit avec eux.
            </RosterEmpty>
          ) : null
        ) : (
          trees.map((tree) => (
            <RosterRow
              key={tree.id}
              thumb={<Text style={styles.glyph}>⚘</Text>}
              title={tree.name}
              detail={summarise(tree)}
              onPress={() => onOpen(tree.id)}
            />
          ))
        )}
      </Roster>

      <Sheet
        visible={naming}
        onClose={() => setNaming(false)}
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
  fill: { flex: 1 },
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  form: { paddingHorizontal: space.xl, paddingBottom: space.lg },
  /** Le résumé, et le filet qui le sépare de la liste. */
  preface: { gap: space.lg },
  /**
   * La même voix que le texte d'une liste vide — `RosterEmpty`.
   *
   * Les deux disent la même chose au même lecteur : *ce qu'est un arbre*. L'un
   * le dit avant la liste, l'autre à la place des rangées quand il n'y en a
   * pas, et rien ne justifiait qu'ils ne se ressemblent pas.
   */
  prefaceText: {
    ...type.body,
    color: palette.inkFaint,
    textAlign: "center",
    paddingHorizontal: space.md,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.line,
  },
  /** A sprig, for want of a portrait: a tree has no face of its own. */
  glyph: { fontSize: 20, color: palette.inkFaint },
});
