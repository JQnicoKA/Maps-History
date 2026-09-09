/**
 * Pulls sovereign borders out of OpenHistoricalMap and writes them as NDJSON —
 * one GeoJSON feature per line — ready to be loaded into Supabase.
 *
 * Why the vector tiles rather than Overpass: the tiler has already done the
 * hard part, assembling OSM relation members into rings. Overpass would hand
 * back loose ways to stitch by hand.
 *
 * The catch is that tiles clip geometry at their edges, so a country spanning
 * two tiles arrives in pieces. Those pieces carry the same `ohm_id`, and the
 * database stitches them back with ST_Union after loading.
 *
 * NDJSON rather than one FeatureCollection: a worldwide sweep runs to hundreds
 * of megabytes, which neither this script nor the loader should ever hold whole.
 *
 *   node scripts/extract-territories.mjs --from 600 --to 2100 > europe.ndjson
 *   node scripts/extract-territories.mjs --world > monde.ndjson
 *
 * Options : --from, --to (années), --west/--south/--east/--north (degrés),
 *           --world (planète entière, toutes époques), --zoom (défaut 5).
 */
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { gunzipSync } from "node:zlib";

const TILE = "https://vtiles.openhistoricalmap.org/maps/ohm_admin";

function arg(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : Number(process.argv[at + 1]);
}
const flag = (name) => process.argv.includes(`--${name}`);

const WORLD = flag("world");

/** z5 geometry is already simplified for continental viewing. */
const ZOOM = arg("zoom", 5);

/** Keep every boundary whose life overlaps this window. */
const WINDOW = {
  from: arg("from", WORLD ? -4000 : 1789),
  to: arg("to", WORLD ? 2100 : 1816),
};

/** Europe by default, from Iceland to the Urals and from Crete to Lapland. */
const BBOX = WORLD
  ? { west: -180, south: -85, east: 180, north: 85 }
  : {
      west: arg("west", -25),
      south: arg("south", 33),
      east: arg("east", 45),
      north: arg("north", 72),
    };

/** Kept modest: the tile server rate-limits bursts with 503s. */
const CONCURRENCY = 6;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const lonToX = (lon, z) => clamp(Math.floor(((lon + 180) / 360) * 2 ** z), 0, 2 ** z - 1);
const latToY = (lat, z) => {
  const r = (clamp(lat, -85, 85) * Math.PI) / 180;
  return clamp(
    Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z),
    0,
    2 ** z - 1,
  );
};

const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

async function fetchTile(z, x, y, attempt = 0) {
  try {
    const res = await fetch(`${TILE}/${z}/${x}/${y}`);
    if (res.status === 503 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      return fetchTile(z, x, y, attempt + 1);
    }
    if (!res.ok) return null;
    const raw = Buffer.from(await res.arrayBuffer());
    return raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw;
  } catch {
    return attempt < 4 ? fetchTile(z, x, y, attempt + 1) : null;
  }
}

const coords = [];
for (let x = lonToX(BBOX.west, ZOOM); x <= lonToX(BBOX.east, ZOOM); x++) {
  for (let y = latToY(BBOX.north, ZOOM); y <= latToY(BBOX.south, ZOOM); y++) {
    coords.push([x, y]);
  }
}

let done = 0;
let fragments = 0;
/** Distinct *names*, not entities: one polity spans many dated versions. */
const names = new Set();

/** Backpressure: a slow stdout must not let the queue grow unbounded. */
function write(line) {
  if (!process.stdout.write(line)) {
    return new Promise((resolve) => process.stdout.once("drain", resolve));
  }
  return undefined;
}

async function handle([x, y]) {
  const buffer = await fetchTile(ZOOM, x, y);
  done++;
  if (done % 25 === 0 || done === coords.length) {
    process.stderr.write(
      `\r  ${done}/${coords.length} tuiles · ${fragments} fragments · ${names.size} noms`,
    );
  }
  if (!buffer) return;

  const layer = new VectorTile(new PbfReader(buffer)).layers["boundaries"];
  if (!layer) return;

  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i);
    const p = feature.properties;
    if (String(p["admin_level"]) !== "2") continue;

    const start = num(p["start_decdate"]);
    const end = num(p["end_decdate"]);
    if ((start ?? -1e6) >= WINDOW.to) continue;
    if ((end ?? 1e6) <= WINDOW.from) continue;

    const geometry = feature.toGeoJSON(x, y, ZOOM).geometry;
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") continue;

    fragments++;
    if (p["name"]) names.add(String(p["name"]));

    await write(
      JSON.stringify({
        ohm_id: p["osm_id"] ?? null,
        name: p["name"] ?? null,
        start_year: start,
        end_year: end,
        geojson: geometry,
      }) + "\n",
    );
  }
}

const queue = coords.slice();
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let next = queue.pop(); next; next = queue.pop()) await handle(next);
  }),
);

process.stderr.write(
  `\n${coords.length} tuiles · ${fragments} fragments · ${names.size} noms distincts\n`,
);
