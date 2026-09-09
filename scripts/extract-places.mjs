/**
 * Pulls historical settlements out of OpenHistoricalMap.
 *
 *   node scripts/extract-places.mjs --world > places.json
 *   node scripts/extract-places.mjs --west -25 --south 33 --east 45 --north 72 > eu.json
 *
 * Separate from extract-territories.mjs because everything differs: another
 * tileset (`ohm` rather than `ohm_admin`), another layer, points instead of
 * polygons, and z6 rather than z5 — the tiler puts no settlement in a tile
 * below that zoom, since a world-scale tile showing every town would be
 * unusable.
 *
 * Points need no stitching: unlike a polygon, a settlement is never cut across
 * tile edges. Deduplication by ohm_id is enough, and it happens here.
 */
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { gunzipSync } from "node:zlib";

const TILE = "https://vtiles.openhistoricalmap.org/maps/ohm";
const LAYER = "place_points_centroids";

/** Below z6 the layer carries only administrative labels, no settlements. */
const ZOOM = 6;
const KEEP = new Set(["city", "town", "village"]);
const CONCURRENCY = 6;

function arg(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : Number(process.argv[at + 1]);
}
const WORLD = process.argv.includes("--world");

const BBOX = WORLD
  ? { west: -180, south: -85, east: 180, north: 85 }
  : {
      west: arg("west", -25),
      south: arg("south", 33),
      east: arg("east", 45),
      north: arg("north", 72),
    };

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const lonToX = (lon) => clamp(Math.floor(((lon + 180) / 360) * 2 ** ZOOM), 0, 2 ** ZOOM - 1);
const latToY = (lat) => {
  const r = (clamp(lat, -85, 85) * Math.PI) / 180;
  return clamp(
    Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** ZOOM),
    0,
    2 ** ZOOM - 1,
  );
};
const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

async function fetchTile(x, y, attempt = 0) {
  try {
    const res = await fetch(`${TILE}/${ZOOM}/${x}/${y}`);
    if (res.status === 503 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      return fetchTile(x, y, attempt + 1);
    }
    if (!res.ok) return null;
    const raw = Buffer.from(await res.arrayBuffer());
    return raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw;
  } catch {
    return attempt < 4 ? fetchTile(x, y, attempt + 1) : null;
  }
}

const coords = [];
for (let x = lonToX(BBOX.west); x <= lonToX(BBOX.east); x++) {
  for (let y = latToY(BBOX.north); y <= latToY(BBOX.south); y++) coords.push([x, y]);
}

const places = new Map();
let done = 0;
let bytes = 0;

async function handle([x, y]) {
  const buffer = await fetchTile(x, y);
  done++;
  if (done % 50 === 0 || done === coords.length) {
    process.stderr.write(
      `\r  ${done}/${coords.length} carreaux · ${places.size} lieux · ${(bytes / 1048576).toFixed(0)} Mo lus`,
    );
  }
  if (!buffer) return;
  bytes += buffer.length;

  const layer = new VectorTile(new PbfReader(buffer)).layers[LAYER];
  if (!layer) return;

  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i);
    const p = feature.properties;
    if (!KEEP.has(String(p["type"]))) continue;
    if (p["osm_id"] == null || places.has(p["osm_id"])) continue;
    if (!p["name"]) continue;

    const geometry = feature.toGeoJSON(x, y, ZOOM).geometry;
    if (geometry.type !== "Point") continue;

    places.set(p["osm_id"], {
      ohm_id: p["osm_id"],
      name: String(p["name"]),
      type: String(p["type"]),
      start_year: num(p["start_decdate"]),
      end_year: num(p["end_decdate"]),
      longitude: Number(geometry.coordinates[0].toFixed(5)),
      latitude: Number(geometry.coordinates[1].toFixed(5)),
    });
  }
}

const queue = coords.slice();
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let next = queue.pop(); next; next = queue.pop()) await handle(next);
  }),
);

const list = [...places.values()];
const dated = list.filter((p) => p.start_year !== null).length;
process.stderr.write(
  `\n${coords.length} carreaux · ${(bytes / 1048576).toFixed(0)} Mo lus · ${list.length} lieux · ${dated} datés (${Math.round((dated / list.length) * 100)} %)\n`,
);

process.stdout.write(JSON.stringify(list) + "\n");
