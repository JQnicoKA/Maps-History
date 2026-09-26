import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

import { washFor } from "./api";
import { supabase } from "../../lib/supabase";

/** A brush stroke: where the finger went, in longitude and latitude. */
export type Stroke = [number, number][];

export type DrawnPolity = {
  id: string;
  name: string;
  from: number;
  to: number;
  area: number | null;
};

/**
 * Sends the strokes and lets the database make a territory of them.
 *
 * Nothing is computed here: thickening a line into a band, merging the bands,
 * repairing what crosses itself, placing the label and choosing a colour that
 * no neighbour already wears — PostGIS does all of it in one statement. The
 * phone has no geometry library, needs none, and the work is the same for one
 * stroke as for forty.
 *
 * `brushMetres` is the brush's radius on the ground, not on the screen. The
 * two differ by the zoom, which is why the caller converts before calling.
 */
export async function drawPolity(options: {
  strokes: Stroke[];
  brushMetres: number;
  name: string;
  from: number;
  to: number;
}): Promise<string> {
  const { data, error } = await supabase().rpc("draw_polity", {
    strokes: options.strokes,
    brush_metres: options.brushMetres,
    polity_name: options.name.trim(),
    from_year: options.from,
    to_year: options.to,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * The reader's own territories in force that year, geometry included.
 *
 * Fetched whole, unlike the reference set: these are counted in dozens rather
 * than hundreds, and a shape drawn with a thumb is far lighter than one
 * digitised at a point every 25 km.
 */
export async function fetchDrawnAt(
  year: number,
): Promise<FeatureCollection<Polygon | MultiPolygon>> {
  const { data, error } = await supabase().rpc("drawn_polities_at", {
    at_year: year,
  });
  if (error) throw new Error(error.message);

  const collection = data as FeatureCollection<Polygon | MultiPolygon>;
  return {
    ...collection,
    /**
     * The wash arrives as an index and has to leave as a colour.
     *
     * The fill layer reads `["get", "wash"]` straight into `fill-color`, so a
     * number reaches MapLibre where a string was wanted and the polygon comes
     * out black. The reference set was already translated on its way in
     * (`fetchChunk`); these were not, which is the whole of the bug.
     */
    features: collection.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        wash: washFor(
          String(feature.properties?.["name"] ?? ""),
          feature.properties?.["wash"],
        ),
      },
    })),
  };
}

/** Everything this account has drawn, for the list that manages them. */
export async function fetchDrawn(): Promise<DrawnPolity[]> {
  const { data, error } = await supabase()
    .from("drawn_polities")
    .select("id, name, start_year, end_year, area")
    .order("start_year");
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as {
      id: string;
      name: string;
      start_year: number;
      end_year: number;
      area: number | null;
    }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    from: row.start_year,
    to: row.end_year,
    area: row.area,
  }));
}

export async function eraseDrawn(id: string): Promise<void> {
  const { error } = await supabase().from("drawn_polities").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
