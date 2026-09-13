import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { SegmentedControl, SelectField } from "../../../components/ui";
import type { Folder, Importance } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, type } from "../../../theme/tokens";

type Choice = Importance | "all";

const IMPORTANCES: { value: Choice; label: string }[] = [
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Élevée" },
];

const ALL: { value: Choice; label: string } = { value: "all", label: "Toutes" };

/**
 * Nullable here even though an event's link never is: the filters use the same
 * control, and there "Toutes" is a real answer. A caller that does not offer it
 * can never receive it.
 */
export type FolderLink = { folderId: string; importance: Importance | null };

export type FolderSelectorProps = {
  folders: Folder[];
  value: FolderLink[];
  onChange: (links: FolderLink[]) => void;
  /** Adds a "Toutes" choice — the filters need it, the form does not. */
  allowAll?: boolean;
  /** What the dashed slot says before anything is chosen. */
  emptyLabel?: string;
};

/**
 * The folders an event belongs to, and its importance *within each one* — the
 * same event can be major to one subject and incidental to another.
 *
 * That pairing is the whole point of the model, so it is drawn as a pairing:
 * one card per folder, carrying its cover, its name and its scale. Before, the
 * folders were a grey summary line and the scales a separate stack below it,
 * and nothing on screen said which belonged to which.
 *
 * Choosing only. Folders are made in the Add sheet's other half, so filing an
 * event never turns into inventing a subject halfway through the form.
 *
 * The importance is a plain segmented control, tapped and nothing else. A
 * slider was tried and taken out: any dragged control inside a scrolling sheet
 * fights the scroll view for the touch, and on iOS the scroll view wins before
 * JavaScript is asked. Three taps beat one drag that works four times in five.
 */
export function FolderSelector({
  folders,
  value,
  onChange,
  allowAll = false,
  emptyLabel = "Ranger dans un classeur",
}: FolderSelectorProps) {
  const segments = allowAll ? [ALL, ...IMPORTANCES] : IMPORTANCES;

  const toggle = (folderId: string) => {
    onChange(
      value.some((link) => link.folderId === folderId)
        ? value.filter((link) => link.folderId !== folderId)
        : [
            ...value,
            // Picking a subject should widen the view when filtering and make
            // a plain choice when composing.
            { folderId, importance: allowAll ? null : "medium" },
          ],
    );
  };

  const setImportance = (folderId: string, importance: Importance | null) => {
    onChange(
      value.map((link) =>
        link.folderId === folderId ? { ...link, importance } : link,
      ),
    );
  };

  return (
    <View style={styles.container}>
      {value.map((link) => {
        const folder = folders.find((one) => one.id === link.folderId);
        return (
          <View key={link.folderId} style={styles.card}>
            <View style={styles.head}>
              <View style={styles.cover}>
                {folder?.photo ? (
                  <Image
                    source={{ uri: folder.photo.url }}
                    style={styles.coverImage}
                  />
                ) : (
                  <Text style={styles.coverInitial}>
                    {folder?.name.charAt(0).toUpperCase() ?? "?"}
                  </Text>
                )}
              </View>

              <Text style={styles.name} numberOfLines={1}>
                {folder?.name ?? "Classeur"}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${folder?.name ?? "ce classeur"}`}
                hitSlop={8}
                onPress={() => toggle(link.folderId)}
                style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
              >
                <Text style={styles.removeGlyph}>×</Text>
              </Pressable>
            </View>

            <Text style={styles.legend}>Importance</Text>
            <SegmentedControl
              segments={segments}
              value={link.importance ?? "all"}
              onChange={(choice) =>
                setImportance(link.folderId, choice === "all" ? null : choice)
              }
            />
          </View>
        );
      })}

      <SelectField
        title="Classeurs"
        placeholder="Choisir un classeur…"
        options={folders.map((folder) => ({
          value: folder.id,
          label: folder.name,
        }))}
        selected={value.map((link) => link.folderId)}
        onToggle={toggle}
        emptyMessage="Aucun classeur. Créez-en un dans « Nouveau classeur »."
        trigger={(open) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter un classeur"
            onPress={open}
            style={({ pressed }) => [styles.add, pressed && styles.pressed]}
          >
            <Text style={styles.addGlyph}>+</Text>
            <Text style={styles.addLabel}>
              {value.length === 0 ? emptyLabel : "Ajouter un classeur"}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const COVER = 40;

const styles = StyleSheet.create({
  container: { gap: space.sm },
  card: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  legend: { ...type.legend, color: palette.inkSoft },
  cover: {
    width: COVER,
    height: COVER,
    borderRadius: COVER / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  coverImage: { width: "100%", height: "100%" },
  coverInitial: { fontSize: 17, fontWeight: "700", color: palette.inkFaint },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: palette.ink },
  remove: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  removeGlyph: { fontSize: 20, lineHeight: 22, color: palette.inkFaint },
  pressed: { opacity: 0.55 },
  // Dashed, so it reads as a slot waiting to be filled rather than a button
  // competing with the cards above it.
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.line,
  },
  addGlyph: { fontSize: 18, lineHeight: 20, color: palette.inkSoft },
  addLabel: { ...type.body, color: palette.inkSoft, fontWeight: "500" },
});
