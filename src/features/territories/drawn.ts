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
  /** In the common chronicle, where anybody may read and copy it. */
  shared: boolean;
  /**
   * A coarse outline, for the list to draw.
   *
   * A territory has no photograph and never will; its shape is the only
   * likeness it has. Null only if the geometry could not be simplified to
   * anything, which would be a shape with no area.
   */
  shape: unknown | null;
  /**
   * The row this was taken from, in another account — null for an original.
   *
   * What it decides today is what the deletion warning may honestly say.
   */
  origin: string | null;
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
/**
 * Everything this account has painted, for the list that manages them.
 *
 * Through a function rather than a plain read, because the outline has to
 * come with it and PostgREST cannot ask for `ST_AsGeoJSON` in a select — see
 * `my_territories`, which is `security invoker` and so still bounded by
 * row-level security.
 */
export async function fetchDrawn(): Promise<DrawnPolity[]> {
  const { data, error } = await supabase().rpc("my_territories");
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as {
      id: string;
      name: string;
      start_year: number;
      end_year: number;
      area: number | null;
      shared: boolean;
      shape: unknown | null;
      origin: string | null;
    }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    from: row.start_year,
    to: row.end_year,
    area: row.area,
    shared: row.shared,
    shape: row.shape,
    origin: row.origin,
  }));
}

/** Puts a drawn territory into the common chronicle, or takes it out. */
export async function shareDrawn(id: string, shared: boolean): Promise<void> {
  const { error } = await supabase()
    .from("drawn_polities")
    .update({ shared })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eraseDrawn(id: string): Promise<void> {
  const { error } = await supabase().from("drawn_polities").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
