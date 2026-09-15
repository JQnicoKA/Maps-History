import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import type { PickedPhoto } from "./types";

/**
 * Opens the photo library and hands back what was chosen, ready to upload.
 *
 * Shared by the event form, the folder cover and the character portraits, so
 * the permission prompt, the quality cap and the shape of the result are
 * decided in one place.
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

  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: multiple,
      // Uploads go through base64, so the picture is held in memory once —
      // quality is capped to keep that reasonable.
      quality: 0.7,
      base64: true,
      /**
       * Ask iOS for the most compatible representation rather than whatever
       * the library happens to hold.
       *
       * Without it the picker asks for `public.jpeg` and gives up on anything
       * it cannot hand over as-is — a HEIC it will not transcode, and above all
       * a picture that lives in iCloud and has never been downloaded to this
       * phone. That is the `FailedToReadImageException: Cannot load
       * representation of type public.jpeg` this used to throw. "Compatible"
       * makes the system convert, fetching from iCloud if it must.
       */
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
  } catch (cause) {
    // The picker rejects rather than returning an error, and every caller
    // fires it with `void`: without this the failure surfaces as an uncaught
    // rejection in the console and as nothing at all to the reader.
    Alert.alert(
      "Photo illisible",
      "iOS n'a pas pu fournir cette image. Si elle est stockée dans iCloud, " +
        "ouvrez-la d'abord dans Photos pour la télécharger, puis réessayez.\n\n" +
        (cause instanceof Error ? cause.message : String(cause)),
    );
    return [];
  }

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
