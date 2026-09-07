import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { InkButton } from "../../../components/ui";
import type { EventDraft } from "../types";
import { palette } from "../../../theme/palette";

type Photos = EventDraft["photos"];

export type PhotoPickerProps = {
  photos: Photos;
  onChange: (photos: Photos) => void;
};

export function PhotoPicker({ photos, onChange }: PhotoPickerProps) {
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

      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.strip}>
            {photos.map((photo, index) => (
              <Pressable
                key={photo.uri}
                accessibilityRole="button"
                accessibilityLabel="Retirer cette photo"
                onPress={() =>
                  onChange(photos.filter((_, position) => position !== index))
                }
              >
                <Image source={{ uri: photo.uri }} style={styles.thumb} />
                <Text style={styles.remove}>×</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}
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
  strip: { flexDirection: "row", gap: 8 },
  thumb: {
    width: 76,
    height: 76,
    borderWidth: 1,
    borderColor: palette.inkFaint,
  },
  remove: {
    position: "absolute",
    top: 1,
    right: 4,
    fontSize: 18,
    color: palette.paperLight,
    textShadowColor: palette.ink,
    textShadowRadius: 3,
  },
});
