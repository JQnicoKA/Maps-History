import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/**
 * The longest side a stored picture keeps, in pixels.
 *
 * A phone hands over twelve megapixels — 4032 × 3024, two to three megabytes —
 * for a picture this app shows in a 44pt disc and, at its very largest, full
 * screen. 1600 covers the tallest phone at three times its density with room to
 * spare, and costs around a tenth of the weight.
 */
const LONGEST = 1600;

/** JPEG quality. High enough that a photograph does not visibly suffer. */
const QUALITY = 0.75;

export type Shrunk = { uri: string; base64: string; mimeType: string };

/**
 * Brings a picked photograph down to a size worth keeping, and to a format
 * everything can read.
 *
 * Three costs at once: the upload, the storage bill, and the memory the picture
 * occupies as a base64 string while it travels — base64 being a third larger
 * again than the file. The format matters too: iPhones hand over HEIC, which
 * the bucket serves happily and half the world cannot display.
 *
 * `null` when the picture cannot be prepared — an image the decoder refuses,
 * say. The caller then sends what the picker gave it: heavy, but sent.
 *
 * **The import is a plain one, and that is a decision.** This package reaches
 * for its native side as it loads, so running this JS on a build without the
 * module takes the whole app down at startup rather than falling back. Every
 * build from here on has it; a build that does not is one that must be made
 * again.
 */
export async function shrink(asset: {
  uri: string;
  width: number;
  height: number;
}): Promise<Shrunk | null> {
  try {
    const context = ImageManipulator.manipulate(asset.uri);

    // One side only: the other follows and the ratio is kept. Resizing by the
    // wrong side would enlarge a portrait instead of shrinking it.
    if (Math.max(asset.width, asset.height) > LONGEST) {
      context.resize(
        asset.width >= asset.height ? { width: LONGEST } : { height: LONGEST },
      );
    }

    const image = await context.renderAsync();
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: QUALITY,
      base64: true,
    });
    if (!saved.base64) return null;

    return { uri: saved.uri, base64: saved.base64, mimeType: "image/jpeg" };
  } catch (cause) {
    console.warn("Picture kept as it came: it could not be prepared.", cause);
    return null;
  }
}
