import type { Feature, MultiPolygon, Polygon } from "geojson";

import { supabase } from "../../lib/supabase";
import { palette } from "../../theme/palette";

export type TerritoryFeature = Feature<Polygon | MultiPolygon>;

/** Stable per name, so an empire keeps its colour as the years go by. */
function washFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const washes = palette.washes;
  return washes[Math.abs(hash) % washes.length]!;
}

/** Identifiers only — a few hundred bytes, no geometry. */
export async function fetchTerritoryIdsAt(year: number): Promise<string[]> {
  const { data, error } = await supabase().rpc("territory_ids_at", {
    at_year: year,
  });
  if (error) throw new Error(error.message);
  return (data as { id: string }[]).map((row) => row.id);
}

/** Geometry for entities the caller does not already hold. */
export async function fetchTerritoriesByIds(
  ids: string[],
): Promise<TerritoryFeature[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase().rpc("territories_by_ids", { ids });
  if (error) throw new Error(error.message);

  const collection = data as { features: TerritoryFeature[] };
  return collection.features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      wash: washFor(String(feature.properties?.["name"] ?? "")),
    },
  }));
}
