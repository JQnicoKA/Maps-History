import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { InkButton, InkField, Sheet } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { pickPhotos } from "../pickPhotos";
import type { Folder, PickedPhoto } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, TOUCH, type } from "../../../theme/tokens";

export type FolderEditModalProps = {
  /**
   * An existing folder to edit, `"new"` to make one, `null` to stay shut.
   */
  target: Folder | "new" | null;
  onClose: () => void;
};

/**
 * A folder's name and cover, whether it already exists or not.
 *
 * Creating used to be a field and a button pinned above the list, which made
 * two ways of saying the same thing — and the quicker of the two could not give
 * the folder a cover. One sheet for both is fewer things to learn, and a new
 * folder can arrive with its picture already on it.
 *
 * Nothing is written until *Enregistrer*, the picture included: it is held as a
 * local choice rather than uploaded on the spot. Otherwise *Annuler* would be a
 * lie — it would undo the name and keep the photograph.
 */
export function FolderEditModal({ target, onClose }: FolderEditModalProps) {
  const { folders, events, addFolder, renameFolder, removeFolder, setFolderPhoto } =
    useEvents();

  const creating = target === "new";
  const folder = creating ? null : target;

  const [name, setName] = useState(folder?.name ?? "");
  /** Chosen but not uploaded — the upload waits for Enregistrer. */
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  /** The existing cover is on its way out. */
  const [cleared, setCleared] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Reading and encoding the picture takes a moment; the frame says so. */
  const [picking, setPicking] = useState(false);

  if (target === null) return null;

  const preview = picked?.uri ?? (cleared ? undefined : folder?.photo?.url);

  const choose = async () => {
    setPicking(true);
    try {
      const [photo] = await pickPhotos({ multiple: false });
      if (!photo) return;
      setPicked(photo);
      setCleared(false);
    } finally {
      setPicking(false);
    }
  };

  const clear = () => {
    setPicked(null);
    setCleared(true);
  };

  const confirmDelete = () => {
    if (!folder) return;
    const filed = events.filter((event) =>
      event.folders.some((link) => link.folderId === folder.id),
    ).length;

    Alert.alert(
      `Supprimer « ${folder.name} » ?`,
      filed === 0
        ? "Ce classeur est vide."
        : `${filed} événement${filed > 1 ? "s" : ""} y ${filed > 1 ? "sont rangés" : "est rangé"}. ` +
          `${filed > 1 ? "Ils ne seront pas supprimés" : "Il ne sera pas supprimé"}, seulement retiré${filed > 1 ? "s" : ""} de ce classeur.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            setSaving(true);
            void removeFolder(folder)
              .then(onClose)
              .catch((cause: unknown) =>
                Alert.alert(
                  "Suppression impossible",
                  cause instanceof Error ? cause.message : String(cause),
                ),
              )
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  };

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed === "") {
      Alert.alert("Nom manquant", "Un classeur a besoin d'un nom.");
      return;
    }
    // Case-insensitive, and the folder being renamed does not count against
    // itself — otherwise its own casing could never be corrected.
    if (
      folders.some(
        (other) =>
          other.id !== folder?.id &&
          other.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      Alert.alert("Classeur existant", `« ${trimmed} » est déjà dans la liste.`);
      return;
    }

    setSaving(true);
    try {
      if (folder === null) {
        // The other way round from an edit, and it has to be: the storage path
        // is built from the folder's id, which does not exist until the row
        // does. A picture that fails after that leaves a folder without its
        // cover — which is worth saying, and worth keeping.
        const created = await addFolder(trimmed);
        if (picked) {
          try {
            await setFolderPhoto(created, picked);
          } catch (cause) {
            Alert.alert(
              "Classeur créé sans sa photo",
              cause instanceof Error ? cause.message : String(cause),
            );
          }
        }
      } else {
        // Picture first: if the upload fails, the name is left alone too, and
        // the sheet stays open on exactly what is left to fix.
        if (picked) await setFolderPhoto(folder, picked);
        else if (cleared && folder.photo) await setFolderPhoto(folder, null);

        if (trimmed !== folder.name) await renameFolder(folder.id, trimmed);
      }
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
      title={creating ? "Nouveau classeur" : "Modifier le classeur"}
      footer={
        <>
          {/* A rare and irreversible action has no business sharing the size
              of an everyday button — the same rule as the event sheet. */}
          {folder ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Supprimer ce classeur"
              disabled={saving}
              onPress={confirmDelete}
              style={({ pressed }) => [
                styles.trash,
                (pressed || saving) && styles.pressed,
              ]}
            >
              <Image source={TRASH} style={styles.trashGlyph} resizeMode="contain" />
            </Pressable>
          ) : null}
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
            accessibilityState={{ busy: picking }}
            disabled={picking}
            onPress={() => void choose()}
            style={({ pressed }) => [styles.frame, pressed && styles.pressed]}
          >
            {picking ? (
              <ActivityIndicator color={palette.inkSoft} />
            ) : preview ? (
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

const TRASH = require("../../../../assets/icons/trash.png");

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
  pressed: { opacity: 0.5 },
  trash: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  trashGlyph: { width: 20, height: 20 },
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
