import * as ImagePicker from "expo-image-picker";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { InkButton } from "../../../components/ui";
import type { EventPhoto, PickedPhoto } from "../types";
import { palette } from "../../../theme/palette";

export type PhotoPickerProps = {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  /** Pictures already in storage — present when editing. */
  existing?: EventPhoto[];
  onChangeExisting?: (photos: EventPhoto[]) => void;
  onRemoveExisting?: (photo: EventPhoto) => void;
};

function PhotoRow({
  uri,
  source,
  onChangeSource,
  onRemove,
}: {
  uri: string;
  source: string;
  onChangeSource: (source: string) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.row}>
      <Image source={{ uri }} style={styles.thumb} />
      <TextInput
        value={source}
        onChangeText={onChangeSource}
        placeholder="Source (lien ou référence)"
        placeholderTextColor={palette.inkFaint}
        style={styles.source}
        autoCapitalize="none"
        multiline
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retirer cette photo"
        hitSlop={8}
        onPress={onRemove}
        style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
      >
        <Text style={styles.removeGlyph}>×</Text>
      </Pressable>
    </View>
  );
}

export function PhotoPicker({
  photos,
  onChange,
  existing = [],
  onChangeExisting,
  onRemoveExisting,
}: PhotoPickerProps) {
  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Accès aux photos refusé",
        "Autorisez l'accès dans les réglages de l'iPhone pour illustrer un événement.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      // Uploads go through base64, so the picture is held in memory once —
      // quality is capped to keep that reasonable.
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;

    const picked = result.assets.flatMap((asset) =>
      asset.base64
        ? [
            {
              uri: asset.uri,
              base64: asset.base64,
              mimeType: asset.mimeType ?? "image/jpeg",
              source: "",
            },
          ]
        : [],
    );
    onChange([...photos, ...picked]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Photos</Text>
        <InkButton label="Ajouter" onPress={() => void pick()} />
      </View>

      {existing.map((photo) => (
        <PhotoRow
          key={photo.id}
          uri={photo.url}
          source={photo.source ?? ""}
          onChangeSource={(source) =>
            onChangeExisting?.(
              existing.map((current) =>
                current.id === photo.id ? { ...current, source } : current,
              ),
            )
          }
          onRemove={() => onRemoveExisting?.(photo)}
        />
      ))}

      {photos.map((photo, index) => (
        <PhotoRow
          key={photo.uri}
          uri={photo.uri}
          source={photo.source}
          onChangeSource={(source) =>
            onChange(
              photos.map((current, position) =>
                position === index ? { ...current, source } : current,
              ),
            )
          }
          onRemove={() =>
            onChange(photos.filter((_, position) => position !== index))
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: palette.inkSoft,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  thumb: {
    width: 58,
    height: 58,
    borderWidth: 1,
    borderColor: palette.inkFaint,
  },
  source: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.inkFaint,
    fontSize: 13,
    color: palette.ink,
  },
  remove: { paddingHorizontal: 4 },
  pressed: { opacity: 0.5 },
  removeGlyph: { fontSize: 20, color: palette.inkFaint },
});
