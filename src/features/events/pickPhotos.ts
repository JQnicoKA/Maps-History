import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import type { PickedPhoto } from "./types";

/**
 * Opens the photo library and hands back what was chosen, ready to upload.
 *
 * Shared by the event form and the folder manager so the permission prompt,
 * the quality cap and the shape of the result are decided in one place.
 */
export async function pickPhotos(
  { multiple }: { multiple: boolean } = { multiple: true },
): Promise<PickedPhoto[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      "Accès aux photos refusé",
      "Autorisez l'accès dans les réglages de l'iPhone pour illustrer un événement.",
    );
    return [];
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: multiple,
    // Uploads go through base64, so the picture is held in memory once —
    // quality is capped to keep that reasonable.
    quality: 0.7,
    base64: true,
  });
  if (result.canceled) return [];

  return result.assets.flatMap((asset) =>
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
}
