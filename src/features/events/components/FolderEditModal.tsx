import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { InkButton, InkField, Sheet } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { pickPhotos } from "../pickPhotos";
import type { Folder, PickedPhoto } from "../types";
import { palette } from "../../../theme/palette";
import { space, type } from "../../../theme/tokens";

export type FolderEditModalProps = {
  /** The folder being edited; null closes the sheet. */
  folder: Folder | null;
  onClose: () => void;
};

/**
 * Renaming a folder and changing its cover, in one place.
 *
 * Nothing is written until *Enregistrer* — including the picture, which is held
 * as a local choice rather than uploaded on the spot. Otherwise *Annuler* would
 * be a lie: it would undo the name and keep the photograph.
 */
export function FolderEditModal({ folder, onClose }: FolderEditModalProps) {
  const { folders, renameFolder, setFolderPhoto } = useEvents();

  const [name, setName] = useState(folder?.name ?? "");
  /** Chosen but not uploaded — the upload waits for Enregistrer. */
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  /** The existing cover is on its way out. */
  const [cleared, setCleared] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!folder) return null;

  const preview = picked?.uri ?? (cleared ? undefined : folder.photo?.url);

  const choose = async () => {
    const [photo] = await pickPhotos({ multiple: false });
    if (!photo) return;
    setPicked(photo);
    setCleared(false);
  };

  const clear = () => {
    setPicked(null);
    setCleared(true);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed === "") {
      Alert.alert("Nom manquant", "Un classeur a besoin d'un nom.");
      return;
    }
    if (
      folders.some(
        (other) =>
          other.id !== folder.id &&
          other.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      Alert.alert("Classeur existant", `« ${trimmed} » est déjà dans la liste.`);
      return;
    }

    setSaving(true);
    try {
      // Picture first: if the upload fails, the name is left alone too, and
      // the sheet stays open on exactly what the reader still has to fix.
      if (picked) await setFolderPhoto(folder, picked);
      else if (cleared && folder.photo) await setFolderPhoto(folder, null);

      if (trimmed !== folder.name) await renameFolder(folder.id, trimmed);
      onClose();
    } catch (cause) {
      Alert.alert(
        "Enregistrement impossible",
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Modifier le classeur"
      footer={
        <>
          <InkButton label="Annuler" variant="tonal" grow onPress={onClose} />
          <InkButton
            label={saving ? "Enregistrement…" : "Enregistrer"}
            variant="solid"
            grow
            disabled={saving}
            onPress={() => void save()}
          />
        </>
      }
    >
      <View style={styles.body}>
        <View style={styles.cover}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={preview ? "Changer la photo" : "Choisir une photo"}
            onPress={() => void choose()}
            style={({ pressed }) => [styles.frame, pressed && styles.pressed]}
          >
            {preview ? (
              <Image source={{ uri: preview }} style={styles.image} />
            ) : (
              <Text style={styles.plus}>+</Text>
            )}
          </Pressable>

          <View style={styles.coverText}>
            <Text style={styles.legend}>Photo de couverture</Text>
            <Text style={styles.hint}>
              Elle sert de marqueur aux événements de ce classeur qui n'ont pas
              de photo à eux.
            </Text>
            {preview ? (
              <Pressable accessibilityRole="button" onPress={clear} hitSlop={6}>
                <Text style={styles.remove}>Retirer la photo</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <InkField
          label="Nom"
          value={name}
          onChangeText={setName}
          placeholder="Guerres de religion"
          returnKeyType="done"
          onSubmitEditing={() => void save()}
        />
      </View>
    </Sheet>
  );
}

const FRAME = 88;

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  cover: { flexDirection: "row", alignItems: "center", gap: space.lg },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: FRAME / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  pressed: { opacity: 0.6 },
  image: { width: "100%", height: "100%" },
  plus: { fontSize: 32, lineHeight: 36, color: palette.inkFaint },
  coverText: { flex: 1, gap: space.xs },
  legend: { ...type.legend, color: palette.inkSoft },
  hint: { ...type.caption, color: palette.inkFaint },
  remove: {
    ...type.caption,
    color: palette.wax,
    fontWeight: "600",
    paddingTop: space.xs,
  },
});
