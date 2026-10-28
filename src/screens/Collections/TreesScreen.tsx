import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { CollectionPage } from "./CollectionPage";
import {
  InkButton,
  InkField,
  RosterRow,
  Sheet,
  useNotice,
} from "../../components/ui";
import { useEvents } from "../../features/events/EventsProvider";
import type { Character, Tree } from "../../features/events/types";
import { headOf } from "../../features/genealogy/head";
import { generationCount } from "../../features/genealogy/layout";
import { palette } from "../../theme/palette";
import { space } from "../../theme/tokens";

export type TreesScreenProps = {
  /** Demande qu'un arbre soit dessiné, plein écran. */
  onOpen: (id: string) => void;
  /** Demande le catalogue de la bibliothèque, côté arbres. */
  onSeek: () => void;
  /** La porte du compte, au bord du bandeau — voir `CollectionPage`. */
  unread: number;
  onProfile: () => void;
};

/**
 * La tête d'un arbre, dans la case de sa rangée.
 *
 * **Une fleur y tenait lieu de tout**, la même pour les quarante arbres d'une
 * liste : une marque de genre, pas une marque d'arbre. Un visage dit lequel on
 * regarde, ce qu'aucun pictogramme ne peut faire.
 *
 * Trois états, dans l'ordre où l'on tombe dessus : le portrait de la tête,
 * son initiale si elle n'en a pas, et la fleur si l'arbre est encore vide —
 * là, il n'y a vraiment rien d'autre à montrer.
 *
 * Qui est la tête, c'est `headOf` qui le dit, et il est écrit à part parce que
 * c'est une règle et non un dessin.
 */
function Head({
  tree,
  people,
}: {
  tree: Tree;
  people: readonly Character[];
}) {
  const id = headOf(tree, people);
  const person = id === null ? undefined : people.find((one) => one.id === id);
  const photo = person?.photos[0]?.url;

  if (photo !== undefined) {
    return (
      <Image
        source={{ uri: photo }}
        /* La case est carrée et déjà rognée par son parent — voir `thumb`
           dans `Roster`. `cover` plutôt que `contain` : un portrait cadré
           vaut mieux qu'un portrait entouré de vide. */
        style={styles.portrait}
        resizeMode="cover"
      />
    );
  }

  if (person !== undefined) {
    return (
      <Text style={styles.initial}>
        {person.name.charAt(0).toUpperCase()}
      </Text>
    );
  }

  return <Text style={styles.glyph}>⚘</Text>;
}

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
export function TreesScreen({ onOpen, onSeek, unread, onProfile }: TreesScreenProps) {
  const { trees, characters, addTree, loading, error, refresh } = useEvents();
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
        owned="Vos arbres"
        count={trees.length}
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
            thumb={<Head tree={one} people={characters} />}
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
        loading={loading}
        failed={error}
        onRetry={() => void refresh()}
        unread={unread}
        onProfile={onProfile}
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
  portrait: { width: "100%", height: "100%" },
  /** La même lettre que sur un nœud de l'arbre, à l'échelle de la case. */
  initial: { fontSize: 20, fontWeight: "700", color: palette.inkFaint },
  form: { paddingHorizontal: space.xl, paddingBottom: space.lg },
});
