import type { FeatureCollection, Point } from "geojson";

import { supabase } from "../../lib/supabase";

export type PlaceCollection = FeatureCollection<Point>;

/**
 * The settlements in existence in a given decimal year.
 *
 * Only cities and towns exist in the extract — the tiler puts no village in a
 * z6 tile — but the parameter stays, so a finer sweep could add them without
 * touching this signature.
 */
export async function fetchPlacesAt(
  year: number,
  types: string[] = ["city", "town"],
): Promise<PlaceCollection> {
  const { data, error } = await supabase().rpc("places_at", {
    at_year: year,
    types,
  });
  if (error) throw new Error(error.message);
  return data as PlaceCollection;
}
