/**
 * Generates the parchment overlay textures in assets/textures.
 *
 * They are checked in, so this only needs re-running when the paper look
 * changes: `node scripts/generate-textures.mjs`. Written by hand rather than
 * pulled from an image library to keep the dependency list at zero.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/textures");

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encodes RGBA bytes as a PNG (filter type 0 on every scanline). */
function encodePng(size, pixels) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * Seamlessly tiling paper: high-frequency fibre over low-frequency staining.
 * The stain uses integer harmonics of the tile size so edges always match.
 */
function paperGrain(size = 256, maxAlpha = 0.5) {
  const random = mulberry32(20260906);
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const stain =
        0.5 * Math.sin(u) * Math.sin(v) +
        0.3 * Math.sin(2 * u + 1.1) * Math.cos(3 * v) +
        0.2 * Math.cos(5 * u - 0.7) * Math.sin(4 * v + 2.3);
      const fibre = random() * 2 - 1;
      const value = 0.7 * fibre + 0.45 * stain;
      const dark = value < 0;
      const offset = (y * size + x) * 4;
      // Dark fibres are sepia, light ones are bleached paper.
      pixels[offset] = dark ? 0x6b : 0xff;
      pixels[offset + 1] = dark ? 0x54 : 0xf6;
      pixels[offset + 2] = dark ? 0x33 : 0xe2;
      pixels[offset + 3] = Math.round(clamp01(Math.abs(value)) * maxAlpha * 255);
    }
  }
  return encodePng(size, pixels);
}

/** Radial darkening, as on a page whose edges have aged fastest. */
function vignette(size = 256, maxAlpha = 0.5) {
  const pixels = Buffer.alloc(size * size * 4);
  const centre = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - centre) / centre;
      const dy = (y - centre) / centre;
      const radius = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
      const falloff = clamp01((radius - 0.45) / 0.55) ** 2;
      const offset = (y * size + x) * 4;
      pixels[offset] = 0x3a;
      pixels[offset + 1] = 0x2c;
      pixels[offset + 2] = 0x1b;
      pixels[offset + 3] = Math.round(falloff * maxAlpha * 255);
    }
  }
  return encodePng(size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [file, data] of [
  ["paper-grain.png", paperGrain()],
  ["vignette.png", vignette()],
]) {
  writeFileSync(resolve(OUT_DIR, file), data);
  console.log(`wrote ${file} (${data.length} bytes)`);
}
