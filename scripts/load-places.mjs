/**
 * Charge le JSON produit par extract-places.mjs dans Supabase.
 *
 *   node scripts/extract-places.mjs --world > places.json
 *   node scripts/load-places.mjs places.json
 *
 * Plus simple que le chargeur de territoires : les points sont légers et déjà
 * dédupliqués, il n'y a ni table de transit ni recollage. Comme lui, il parle à
 * PostgREST en fetch brut — supabase-js exige un WebSocket que Node 20 n'a pas.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/load-places.mjs <fichier.json>");
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

async function rest(path, init, attempt = 0) {
  const res = await fetch(`${REST}${path}`, { ...init, headers: HEADERS });
  if (!res.ok) {
    if (attempt < 3 && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      return rest(path, init, attempt + 1);
    }
    throw new Error(`${res.status} ${await res.text()}`);
  }
}

const places = JSON.parse(readFileSync(file, "utf8"));
console.log(`${places.length} lieux à charger`);

await rest("/places?ohm_id=gt.0", { method: "DELETE" });

const BATCH = 500;
for (let i = 0; i < places.length; i += BATCH) {
  await rest("/places", {
    method: "POST",
    body: JSON.stringify(places.slice(i, i + BATCH)),
  });
  process.stdout.write(`\r  ${Math.min(i + BATCH, places.length)}/${places.length}`);
}
console.log("\nchargé.");
