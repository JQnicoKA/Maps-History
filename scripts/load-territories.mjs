/**
 * Loads the NDJSON produced by extract-territories.mjs into Supabase.
 *
 *   node scripts/extract-territories.mjs --world > monde.ndjson
 *   node scripts/load-territories.mjs monde.ndjson
 *
 * Reads line by line and posts size-bounded batches: a worldwide sweep runs to
 * hundreds of megabytes, so neither the file nor a batch is ever held whole.
 * Talks to PostgREST with plain fetch rather than supabase-js, whose realtime
 * client wants a WebSocket Node 20 lacks.
 */
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/load-territories.mjs <fichier.ndjson>");
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

/** Big enough to keep the round-trip count low, small enough to stay accepted. */
const BATCH_BYTES = 1_500_000;
const IN_FLIGHT = 3;

async function post(body, attempt = 0) {
  const res = await fetch(`${REST}/territory_fragments`, {
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

await fetch(`${REST}/territory_fragments?id=gt.0`, {
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

const lines = createInterface({
  input: createReadStream(file),
  crlfDelay: Infinity,
});

for await (const line of lines) {
  if (line.trim() === "") continue;
  batch.push(JSON.parse(line));
  bytes += line.length;
  loaded++;

  if (bytes >= BATCH_BYTES) {
    await send(batch);
    batch = [];
    bytes = 0;
    process.stdout.write(`\r  ${loaded} fragments`);
  }
}

if (batch.length > 0) await send(batch);
await Promise.all(pending);

console.log(`\r  ${loaded} fragments chargés.`);
