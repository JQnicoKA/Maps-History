import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { CollectionPage } from "./CollectionPage";
import {
  InkButton,
  InkField,
  RosterRow,
  Sheet,
  useNotice,
} from "../../components/ui";
import { useEvents } from "../../features/events/EventsProvider";
import type { Tree } from "../../features/events/types";
import { generationCount } from "../../features/genealogy/layout";
import { palette } from "../../theme/palette";
import { space } from "../../theme/tokens";

export type TreesScreenProps = {
  /** Demande qu'un arbre soit dessiné, plein écran. */
  onOpen: (id: string) => void;
  /** Demande le catalogue de la bibliothèque, côté arbres. */
  onSeek: () => void;
};

/**
 * Les arbres de la collection.
 *
 * Elle remplace `TreeManager` et la feuille qui le portait. Un arbre se fait
 * **en un mot** — son nom — et se bâtit ensuite plein écran, là où il y a la
 * place de l'arranger ; la feuille de nommage reste donc, mais elle est tout
 * ce qui subsiste de l'ancien panneau.
 *
 * Le dessin n'est pas ouvert ici mais demandé. Il est plein écran et il porte
 * des pages à lui — la fiche d'un personnage, et les sorties qu'elle offre —
 * donc il appartient au sommet de l'application, là où rien de ce qu'il ouvre
 * n'a besoin d'être un panneau dans un panneau.
 */
export function TreesScreen({ onOpen, onSeek }: TreesScreenProps) {
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
      // nobody builds.
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
    <View style={styles.page}>
      {dialog}

      <CollectionPage
        title="Arbres"
        count={
          trees.length === 0
            ? "Aucun arbre"
            : `${trees.length} arbre${trees.length > 1 ? "s" : ""}`
        }
        seekLabel="Rechercher un arbre"
        onSeek={onSeek}
        addLabel="Créer un arbre"
        onAdd={() => {
          setName("");
          setNaming(true);
        }}
        data={trees}
        keyOf={(one) => one.id}
        row={(one) => (
          <RosterRow
            thumb={<Text style={styles.glyph}>⚘</Text>}
            title={one.name}
            detail={summarise(one)}
            onPress={() => onOpen(one.id)}
          />
        )}
        /* Un renseignement et non une définition : sans personnages, on ne
           peut rien bâtir du tout, et c'est la seule chose qu'un lecteur ne
           peut pas deviner en regardant la page. */
        empty={
          characters.length === 0
            ? "Créez d'abord des personnages : un arbre se bâtit avec eux."
            : "Aucun arbre pour l'instant. Un arbre relie vos personnages entre eux, génération par génération."
        }
      />

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
    </View>
  );
}

/** Ce qu'un arbre pèse, en une ligne : des gens, des rangs, des liens. */
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
  page: { flex: 1, backgroundColor: palette.surface },
  /** A sprig, for want of a portrait: a tree has no face of its own. */
  glyph: { fontSize: 20, color: palette.inkFaint },
  form: { paddingHorizontal: space.xl, paddingBottom: space.lg },
});
