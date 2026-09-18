import * as ImagePicker from "expo-image-picker";

import type { PickedPhoto } from "./types";

/** Why nothing came back, in the words the reader should see. */
export type PickProblem = { title: string; message: string };

export type Picked = { photos: PickedPhoto[]; problem: PickProblem | null };

/**
 * Opens the photo library and hands back what was chosen, ready to upload.
 *
 * Shared by the event form, the folder cover and the character portraits, so
 * the permission prompt, the quality cap and the shape of the result are
 * decided in one place.
 *
 * **It reports its troubles rather than showing them.** A module cannot draw a
 * dialogue, and the system alert it used to raise was the last piece of another
 * application's furniture left in this one. The caller has a sheet on screen
 * and can say it properly.
 */
export async function pickPhotos(
  { multiple }: { multiple: boolean } = { multiple: true },
): Promise<Picked> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      photos: [],
      problem: {
        title: "Accès aux photos refusé",
        message:
          "Autorisez l'accès dans les réglages de l'iPhone pour illustrer un événement.",
      },
    };
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
    // The picker rejects rather than returning an error, and callers fire it
    // with `void`: unreported, the failure surfaces as an uncaught rejection in
    // the console and as nothing at all to the reader.
    return {
      photos: [],
      problem: {
        title: "Photo illisible",
        message:
          "iOS n'a pas pu fournir cette image. Si elle est stockée dans iCloud, " +
          "ouvrez-la d'abord dans Photos pour la télécharger, puis réessayez.\n\n" +
          (cause instanceof Error ? cause.message : String(cause)),
      },
    };
  }

  if (result.canceled) return { photos: [], problem: null };

  const photos = result.assets.flatMap((asset) =>
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
  return { photos, problem: null };
}
