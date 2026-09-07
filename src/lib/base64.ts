const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const LOOKUP = new Uint8Array(128);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

/**
 * Decodes base64 to bytes. React Native ships no `atob` and no `Buffer`, and
 * the image picker hands us base64 — this is the whole reason a dependency
 * would otherwise be needed.
 */
export function decodeBase64(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array((clean.length * 3) >> 2);

  let byte = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)] ?? 0;
    const b = LOOKUP[clean.charCodeAt(i + 1)] ?? 0;
    const c = LOOKUP[clean.charCodeAt(i + 2)] ?? 0;
    const d = LOOKUP[clean.charCodeAt(i + 3)] ?? 0;

    bytes[byte++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) bytes[byte++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) bytes[byte++] = ((c & 3) << 6) | d;
  }

  return bytes.subarray(0, byte);
}
