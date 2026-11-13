import type { Feature, MultiPolygon, Polygon } from "geojson";

import { TERRITORY_RPC } from "../../config/map";
import { supabase } from "../../lib/supabase";
import { palette } from "../../theme/palette";

export type TerritoryFeature = Feature<Polygon | MultiPolygon>;

/**
 * The wash a polity is painted in.
 *
 * Cliopatria carries its own `wash`: an index handed out by map colouring, so
 * that two polities which ever shared a border are never the same colour. See
 * `scripts/colour-polities.mjs`.
 *
 * OpenHistoricalMap has no such index, and falls back to what both sets used
 * before — a hash of the name. Stable per polity, but blind to geography: it
 * gave the same wash to about one pair of neighbours in seven.
 */
export function washFor(name: string, index: unknown): string {
  const washes = palette.washes;
  if (typeof index === "number") return washes[index % washes.length]!;

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return washes[Math.abs(hash) % washes.length]!;
}

/**
 * Identifiers only — a few hundred bytes, no geometry.
 *
 * `maxLevel` is 2 for the top rank of each region — sovereigns, plus the fiefs
 * no sovereign covered in their day — and 4 to add the subordinate fiefs. The
 * latter double the weight of a date and are only drawn from country zoom, so
 * they are asked for only once the reader is there.
 */
export async function fetchTerritoryIdsAt(
  year: number,
  maxLevel: number,
): Promise<string[]> {
  const { data, error } = await supabase().rpc(TERRITORY_RPC.ids, {
    at_year: year,
    max_level: maxLevel,
  });
  if (error) throw new Error(error.message);
  return (data as { id: string }[]).map((row) => row.id);
}

/**
 * Entities per request. A single call for a busy date meant one 7 MB response
 * built in one statement, which ran past the anon role's timeout and returned
 * nothing at all. Around 120 keeps each request near a second and the failure
 * of one from costing the rest.
 */
const CHUNK = 120;

/** Requests in flight. Enough to hide the latency, few enough to stay polite. */
const IN_FLIGHT = 3;

async function fetchChunk(ids: string[]): Promise<TerritoryFeature[]> {
  const { data, error } = await supabase().rpc(TERRITORY_RPC.byIds, { ids });
  if (error) throw new Error(error.message);

  const collection = data as { features: TerritoryFeature[] };
  return collection.features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      wash: washFor(
        String(feature.properties?.["name"] ?? ""),
        feature.properties?.["wash"],
      ),
    },
  }));
}

/**
 * Geometry for entities the caller does not already hold.
 *
 * Each chunk that arrives is handed to `keep` straight away, even if another
 * fails: a retry then asks only for what is still missing, instead of throwing
 * away the two chunks that made it because the third ran out of time. The
 * failure is still reported, once every wave has had its chance.
 */
export async function fetchTerritoriesByIds(
  ids: string[],
  keep?: (features: TerritoryFeature[]) => void,
): Promise<TerritoryFeature[]> {
  const chunks: string[][] = [];
  for (let at = 0; at < ids.length; at += CHUNK) {
    chunks.push(ids.slice(at, at + CHUNK));
  }

  const features: TerritoryFeature[] = [];
  let failure: unknown = null;
  for (let at = 0; at < chunks.length; at += IN_FLIGHT) {
    const wave = await Promise.allSettled(
      chunks.slice(at, at + IN_FLIGHT).map(fetchChunk),
    );
    for (const part of wave) {
      if (part.status === "fulfilled") {
        keep?.(part.value);
        features.push(...part.value);
      } else {
        failure ??= part.reason;
      }
    }
  }
  if (failure !== null) throw failure;
  return features;
}
