/**
 * Colours the polities so that no two that ever shared a border share a wash.
 *
 *   node scripts/colour-polities.mjs          # calcule et écrit
 *   node scripts/colour-polities.mjs --dry    # calcule et rapporte, sans écrire
 *
 * Runs after `build-polities.sql`, and again whenever the borders change.
 * Reads `polity_edges` — the adjacency graph the database builds — and writes
 * `polity_wash`, one row per polity name.
 *
 * **By name, not by version.** A polity keeps one wash for the whole of its
 * history, so dragging the frieze moves borders without repainting the map.
 * The price is a stronger constraint: France and Burgundy must differ even if
 * they only touched for a decade. The graph is the union of every date's map,
 * which is why it is not planar and why four colours are not enough.
 */
import { readFileSync } from "node:fs";

const DRY = process.argv.includes("--dry");

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
const HEADERS = { apikey: KEY, authorization: `Bearer ${KEY}` };

/**
 * Must match `palette.washes.length`. Nine is what this graph needs: eight
 * leave exactly one border uncoloured, nine leave none.
 */
const COLOURS = 9;

async function page(path) {
  const rows = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const res = await fetch(`${REST}/${path}`, {
      headers: { ...HEADERS, range: `${from}-${from + step - 1}` },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < step) return rows;
  }
}

/** Spreads the unconstrained choices instead of piling them on colour 0. */
function preference(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % COLOURS;
}

const [edges, versions] = await Promise.all([
  page("polity_edges?select=a,b"),
  page("polities?select=name"),
]);

const names = [...new Set(versions.map((row) => row.name))].sort();
const graph = new Map(names.map((name) => [name, new Set()]));
for (const { a, b } of edges) {
  graph.get(a)?.add(b);
  graph.get(b)?.add(a);
}

console.log(
  `${names.length} polités · ${edges.length} voisinages · ` +
    `degré max ${Math.max(...[...graph.values()].map((set) => set.size))}`,
);

/**
 * DSATUR: colour next whichever polity already has the most different colours
 * around it — the most constrained one, the one likeliest to run out of
 * choices later. Ties go to the most connected. Among the colours still
 * allowed, the scan starts at the name's own preference, which costs nothing
 * and keeps isolated polities from all coming out the same.
 */
const colour = new Map();
const seen = new Map(names.map((name) => [name, new Set()]));
const pending = new Set(names);

while (pending.size > 0) {
  let best = null;
  let bestSaturation = -1;
  let bestDegree = -1;
  for (const name of pending) {
    const saturation = seen.get(name).size;
    const degree = graph.get(name).size;
    if (saturation > bestSaturation || (saturation === bestSaturation && degree > bestDegree)) {
      best = name;
      bestSaturation = saturation;
      bestDegree = degree;
    }
  }

  const taken = seen.get(best);
  const start = preference(best);
  let pick = -1;
  for (let step = 0; step < COLOURS; step++) {
    const candidate = (start + step) % COLOURS;
    if (!taken.has(candidate)) {
      pick = candidate;
      break;
    }
  }

  if (pick === -1) {
    // Out of colours: take the one the fewest neighbours are using, so the
    // clash lands on the shortest border rather than the longest.
    const tally = new Array(COLOURS).fill(0);
    for (const other of graph.get(best)) {
      const had = colour.get(other);
      if (had !== undefined) tally[had]++;
    }
    pick = tally.indexOf(Math.min(...tally));
    console.warn(`  ! ${best} n'avait plus de couleur libre (${taken.size} prises)`);
  }

  colour.set(best, pick);
  pending.delete(best);
  for (const other of graph.get(best)) seen.get(other)?.add(pick);
}

const broken = edges.filter(({ a, b }) => colour.get(a) === colour.get(b));
const tally = new Array(COLOURS).fill(0);
for (const value of colour.values()) tally[value]++;

console.log(`voisinages de même couleur : ${broken.length} sur ${edges.length}`);
for (const pair of broken.slice(0, 10)) console.log(`  ${pair.a} / ${pair.b}`);
console.log(`répartition : ${tally.join(" · ")}`);

if (DRY) {
  console.log("\n--dry : rien n'a été écrit.");
  process.exit(0);
}

const rows = [...colour].map(([name, wash]) => ({ name, wash }));
for (let at = 0; at < rows.length; at += 500) {
  const res = await fetch(`${REST}/polity_wash`, {
    method: "POST",
    headers: {
      ...HEADERS,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows.slice(at, at + 500)),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}
console.log(`${rows.length} couleurs écrites.`);
