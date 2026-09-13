/**
 * Loads the Cliopatria dataset into Supabase.
 *
 *   curl -sLO https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/main/cliopatria.geojson.zip
 *   unzip cliopatria.geojson.zip
 *   node --max-old-space-size=6144 scripts/load-cliopatria.mjs cliopatria_polities_only.geojson
 *
 * Cliopatria (Seshat Global History Databank, CC BY 4.0) hands over whole
 * geometry rather than tiles, so there is no extraction and no stitching: this
 * is the only step before the SQL pass in `build-polities.sql`.
 *
 * The file is one 165 MB JSON document — hence the enlarged heap. Uploading is
 * still done in byte-bounded batches, and talks to PostgREST with plain fetch:
 * `supabase-js` drags in a realtime client that wants a WebSocket Node 20 lacks.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error(
    "usage: node --max-old-space-size=6144 scripts/load-cliopatria.mjs <cliopatria_polities_only.geojson>",
  );
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return [key.trim(), rest.join("=").trim().replace(/^"|"$/g, "")];
    }),
);

const REST = `${env["EXPO_PUBLIC_SUPABASE_URL"]}/rest/v1`;
const KEY = env["EXPO_PUBLIC_SUPABASE_ANON_KEY"];
const HEADERS = {
  apikey: KEY,
  authorization: `Bearer ${KEY}`,
  "content-type": "application/json",
  prefer: "return=minimal",
};

const BATCH_BYTES = 1_500_000;
const IN_FLIGHT = 3;

/**
 * Two kinds of record are left out, and both would otherwise be drawn on top of
 * the polities they are made of:
 *
 * - `RELATION` — a vassalage or an allegiance, whose geometry is the union of
 *   the two parties.
 * - a `POLITY` whose name is parenthesised — the same union, filed as a polity:
 *   "(Kingdom of France)" is France *plus* its vassals, while "Kingdom of
 *   France" is the royal domain alone.
 *
 * What remains is a single political rank that tiles the map without overlaps.
 */
const keep = (f) =>
  f.properties.Type === "POLITY" && !f.properties.Name.startsWith("(");

const text = readFileSync(file, "utf8");
const features = JSON.parse(text).features;
const kept = features.filter(keep);
console.log(
  `${features.length} enregistrements, ${kept.length} retenus ` +
    `(${features.length - kept.length} relations et agrégats écartés)`,
);

async function post(body, attempt = 0) {
  const res = await fetch(`${REST}/polity_fragments`, {
    method: "POST",
    headers: HEADERS,
    body,
  });
  if (!res.ok) {
    if (attempt < 3 && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      return post(body, attempt + 1);
    }
    throw new Error(`${res.status} ${await res.text()}`);
  }
}

await fetch(`${REST}/polity_fragments?id=gt.0`, {
  method: "DELETE",
  headers: HEADERS,
});
console.log("table de transit vidée");

const pending = new Set();
async function send(rows) {
  const task = post(JSON.stringify(rows)).finally(() => pending.delete(task));
  pending.add(task);
  if (pending.size >= IN_FLIGHT) await Promise.race(pending);
}

let batch = [];
let bytes = 0;
let loaded = 0;

for (const f of kept) {
  const p = f.properties;
  const row = {
    name: p.Name,
    start_year: p.FromYear,
    end_year: p.ToYear,
    area_km2: p.Area ?? null,
    wikidata: p.Wikidata || null,
    wikipedia: p.Wikipedia || null,
    seshat_id: p.SeshatID || null,
    geojson: f.geometry,
  };
  const line = JSON.stringify(row);
  batch.push(row);
  bytes += line.length;
  loaded++;

  if (bytes >= BATCH_BYTES) {
    await send(batch);
    batch = [];
    bytes = 0;
    process.stdout.write(`\r  ${loaded}/${kept.length} polités`);
  }
}

if (batch.length > 0) await send(batch);
await Promise.all(pending);

console.log(`\r  ${loaded} polités chargées.          `);
