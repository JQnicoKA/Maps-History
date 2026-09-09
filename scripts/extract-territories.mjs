/**
 * Pulls sovereign borders for one period out of OpenHistoricalMap and writes
 * them as GeoJSON fragments, ready to be loaded into Supabase.
 *
 * Why the vector tiles rather than Overpass: the tiler has already done the
 * hard part — assembling OSM relation members into rings. Overpass would hand
 * back loose ways to stitch by hand.
 *
 * The catch is that tiles clip geometry at their edges, so a country spanning
 * two tiles arrives in pieces. Those pieces carry the same `osm_id`, and the
 * database stitches them back with ST_Union after loading.
 *
 *   node scripts/extract-territories.mjs --from 600 --to 2100 > out.geojson
 *
 * Options : --from, --to (années), --west, --south, --east, --north (degrés).
 */
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { gunzipSync } from "node:zlib";

const TILE = "https://vtiles.openhistoricalmap.org/maps/ohm_admin";
/** z5 geometry is already simplified for continental viewing. */
const ZOOM = 5;

function arg(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : Number(process.argv[at + 1]);
}

/** Keep every boundary whose life overlaps this window. */
const WINDOW = { from: arg("from", 1789), to: arg("to", 1816) };

/** Europe by default, from Iceland to the Urals and from Crete to Lapland. */
const BBOX = {
  west: arg("west", -25),
  south: arg("south", 33),
  east: arg("east", 45),
  north: arg("north", 72),
};

const lonToX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const latToY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z,
  );
};

const num = (value) =>
  value === undefined || value === null || value === "" ? null : Number(value);

async function fetchTile(z, x, y) {
  const response = await fetch(`${TILE}/${z}/${x}/${y}`, {
    headers: { "accept-encoding": "gzip" },
  });
  if (!response.ok) return null;
  const raw = Buffer.from(await response.arrayBuffer());
  // fetch decompresses transparently; guard in case it does not.
  return raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw;
}

const features = [];
const seen = new Set();

const xs = [lonToX(BBOX.west, ZOOM), lonToX(BBOX.east, ZOOM)];
const ys = [latToY(BBOX.north, ZOOM), latToY(BBOX.south, ZOOM)];

let fetched = 0;
for (let x = xs[0]; x <= xs[1]; x++) {
  for (let y = ys[0]; y <= ys[1]; y++) {
    const buffer = await fetchTile(ZOOM, x, y);
    if (!buffer) continue;
    fetched++;

    const layer = new VectorTile(new PbfReader(buffer)).layers["boundaries"];
    if (!layer) continue;

    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      const p = feature.properties;

      if (String(p["admin_level"]) !== "2") continue;

      const start = num(p["start_decdate"]);
      const end = num(p["end_decdate"]);
      // Keep anything whose life overlaps the window at all.
      if ((start ?? -1e6) >= WINDOW.to) continue;
      if ((end ?? 1e6) <= WINDOW.from) continue;

      const geojson = feature.toGeoJSON(x, y, ZOOM);
      if (geojson.geometry.type !== "Polygon" && geojson.geometry.type !== "MultiPolygon") {
        continue;
      }

      features.push({
        type: "Feature",
        properties: {
          ohm_id: p["osm_id"] ?? null,
          name: p["name"] ?? null,
          start_year: start,
          end_year: end,
        },
        geometry: geojson.geometry,
      });
      if (p["name"]) seen.add(String(p["name"]));
    }
  }
}

process.stderr.write(
  `fenêtre ${WINDOW.from}–${WINDOW.to} | ${fetched} tuiles lues | ` +
    `${features.length} fragments | ${seen.size} entités distinctes\n`,
);

process.stdout.write(
  JSON.stringify({ type: "FeatureCollection", features }) + "\n",
);
