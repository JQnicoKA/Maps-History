import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { generationCount } from "./layout";
import { TreeBuilder } from "./TreeBuilder";
import {
  InkButton,
  InkField,
  useNotice,
} from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import type { Tree } from "../events/types";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

/**
 * The genealogies, listed.
 *
 * A tree is made in one field — it needs nothing but a name to exist — and
 * built afterwards, full screen, where there is room to arrange it. The sheet
 * is the index; the builder is the work.
 */
export function TreeManager() {
  const { trees, characters, addTree } = useEvents();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const { say, dialog } = useNotice();
  const [open, setOpen] = useState<string | null>(null);

  const create = async () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    setCreating(true);
    try {
      const tree = await addTree(trimmed);
      setName("");
      setOpen(tree.id);
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
      <View style={styles.createRow}>
        <View style={styles.createField}>
          <InkField
            label="Nom de l'arbre"
            value={name}
            onChangeText={setName}
            placeholder="Les Capétiens"
            onSubmitEditing={() => void create()}
          />
        </View>
        <InkButton
          label={creating ? "…" : "Créer"}
          variant="solid"
          disabled={creating || name.trim() === ""}
          onPress={() => void create()}
        />
      </View>

      <View style={styles.list}>
        <Text style={styles.legend}>
          {trees.length === 0
            ? "Aucun arbre"
            : `${trees.length} arbre${trees.length > 1 ? "s" : ""}`}
        </Text>

        {trees.length === 0 ? (
          <Text style={styles.empty}>
            {characters.length === 0
              ? "Créez d'abord des personnages : un arbre se bâtit avec eux."
              : "Nommez-en un ci-dessus. Il s'ouvrira en plein écran pour être bâti."}
          </Text>
        ) : (
          trees.map((tree) => (
            <Pressable
              key={tree.id}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir ${tree.name}`}
              onPress={() => setOpen(tree.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {tree.name}
                </Text>
                <Text style={styles.detail} numberOfLines={1}>
                  {summarise(tree)}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        )}
      </View>

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
  createRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  createField: { flex: 1 },
  list: { gap: space.sm },
  legend: { ...type.legend, color: palette.inkSoft },
  empty: { ...type.body, color: palette.inkFaint },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: "600", color: palette.ink },
  detail: { ...type.caption, color: palette.inkFaint },
  chevron: { fontSize: 22, color: palette.inkFaint },
  pressed: { opacity: 0.6 },
});
