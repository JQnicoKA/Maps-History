/**
 * Loads the fragments produced by extract-territories.mjs into Supabase, then
 * asks the database to stitch and simplify them.
 *
 *   node scripts/extract-territories.mjs > /tmp/territories.geojson
 *   node scripts/load-territories.mjs /tmp/territories.geojson
 *
 * Reads the same EXPO_PUBLIC_* credentials as the app; the prototype RLS policy
 * lets the publishable key write. Talks to PostgREST with plain fetch rather
 * than supabase-js, whose realtime client wants a WebSocket Node 20 lacks.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/load-territories.mjs <fichier.geojson>");
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
};

async function rest(path, init) {
  const response = await fetch(`${REST}${path}`, { ...init, headers: HEADERS });
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  return response;
}

const { features } = JSON.parse(readFileSync(file, "utf8"));
console.log(`${features.length} fragments à charger`);

await rest("/territory_fragments?id=gt.0", { method: "DELETE" });

const BATCH = 10;
for (let i = 0; i < features.length; i += BATCH) {
  const rows = features.slice(i, i + BATCH).map((feature) => ({
    ohm_id: feature.properties.ohm_id,
    name: feature.properties.name,
    start_year: feature.properties.start_year,
    end_year: feature.properties.end_year,
    geojson: feature.geometry,
  }));

  await rest("/territory_fragments", {
    method: "POST",
    body: JSON.stringify(rows),
  });
  process.stdout.write(`\r  ${Math.min(i + BATCH, features.length)}/${features.length}`);
}
console.log("\nchargé.");
