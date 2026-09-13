import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { InkButton, InkField, Sheet } from "../../../components/ui";
import { pickPhotos } from "../pickPhotos";
import type { EventPhoto, PickedPhoto } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, type } from "../../../theme/tokens";

export type PhotoPickerProps = {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  /** Pictures already in storage — present when editing. */
  existing?: EventPhoto[];
  onChangeExisting?: (photos: EventPhoto[]) => void;
  onRemoveExisting?: (photo: EventPhoto) => void;
};

/** Which tile is open in the sheet: one already stored, or one just chosen. */
type Open =
  | { kind: "existing"; id: string }
  | { kind: "picked"; index: number };

function Tile({
  uri,
  sourced,
  onPress,
}: {
  uri: string;
  sourced: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Modifier cette photo"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <Image source={{ uri }} style={styles.image} />
      {/* A quiet mark, so a sourced picture can be told from an unsourced one
          without opening either. */}
      {sourced ? <View style={styles.sourced} /> : null}
    </Pressable>
  );
}

/**
 * A rail of thumbnails, with one sheet behind whichever is tapped.
 *
 * It was a table — a column of rows, each a thumbnail beside a text field and a
 * cross. Correct, and joyless: the source line, filled in perhaps once in five,
 * was given more room than the picture itself. Here the pictures are the
 * control and the source waits behind a tap, which is the right order of
 * importance and lets a dozen photographs sit where three used to.
 */
export function PhotoPicker({
  photos,
  onChange,
  existing = [],
  onChangeExisting,
  onRemoveExisting,
}: PhotoPickerProps) {
  const [open, setOpen] = useState<Open | null>(null);

  const add = async () => {
    const picked = await pickPhotos({ multiple: true });
    if (picked.length > 0) onChange([...photos, ...picked]);
  };

  const opened =
    open === null
      ? undefined
      : open.kind === "existing"
        ? existing.find((photo) => photo.id === open.id)
        : photos[open.index];

  const setSource = (source: string) => {
    if (open === null) return;
    if (open.kind === "existing") {
      onChangeExisting?.(
        existing.map((photo) =>
          photo.id === open.id ? { ...photo, source } : photo,
        ),
      );
    } else {
      onChange(
        photos.map((photo, index) =>
          index === open.index ? { ...photo, source } : photo,
        ),
      );
    }
  };

  const remove = () => {
    if (open === null) return;
    if (open.kind === "existing") {
      const photo = existing.find((one) => one.id === open.id);
      if (photo) onRemoveExisting?.(photo);
    } else {
      onChange(photos.filter((_, index) => index !== open.index));
    }
    setOpen(null);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter des photos"
          onPress={() => void add()}
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          <Text style={styles.addGlyph}>+</Text>
        </Pressable>

        {existing.map((photo) => (
          <Tile
            key={photo.id}
            uri={photo.url}
            sourced={Boolean(photo.source)}
            onPress={() => setOpen({ kind: "existing", id: photo.id })}
          />
        ))}

        {photos.map((photo, index) => (
          <Tile
            key={photo.uri}
            uri={photo.uri}
            sourced={photo.source.trim() !== ""}
            onPress={() => setOpen({ kind: "picked", index })}
          />
        ))}
      </ScrollView>

      {existing.length + photos.length === 0 ? (
        <Text style={styles.hint}>
          Sans photo, le marqueur prendra celle du classeur, ou l'emoji du type.
        </Text>
      ) : null}

      <Sheet
        visible={opened !== undefined}
        onClose={() => setOpen(null)}
        title="Photo"
        footer={
          <>
            <InkButton
              label="Retirer"
              variant="quiet"
              tone="wax"
              grow
              onPress={remove}
            />
            <InkButton
              label="Terminé"
              variant="solid"
              grow
              onPress={() => setOpen(null)}
            />
          </>
        }
      >
        <View style={styles.sheet}>
          {opened === undefined ? null : (
            <Image
              source={{ uri: "url" in opened ? opened.url : opened.uri }}
              style={styles.preview}
            />
          )}
          <InkField
            label="Source"
            value={opened?.source ?? ""}
            onChangeText={setSource}
            placeholder="Lien ou référence"
            autoCapitalize="none"
            multiline
          />
        </View>
      </Sheet>
    </View>
  );
}

const TILE = 84;

const styles = StyleSheet.create({
  container: { gap: space.sm },
  rail: { gap: space.sm },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: palette.sunken,
  },
  image: { width: "100%", height: "100%" },
  sourced: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: palette.paperLight,
    borderWidth: 1.5,
    borderColor: palette.wax,
  },
  // Dashed, so it reads as a slot waiting to be filled rather than a button.
  add: {
    width: TILE,
    height: TILE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.line,
  },
  addGlyph: { fontSize: 26, lineHeight: 30, color: palette.inkSoft },
  pressed: { opacity: 0.55 },
  hint: { ...type.caption, color: palette.inkFaint },
  sheet: { paddingHorizontal: space.xl, gap: space.lg },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: palette.sunken,
  },
});
