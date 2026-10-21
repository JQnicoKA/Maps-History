import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

import { washFor } from "./api";
import { supabase } from "../../lib/supabase";

/** A brush stroke: where the finger went, in longitude and latitude. */
export type Stroke = [number, number][];

/**
 * Un coup de pinceau posé : le chemin, et la largeur qu'il avait.
 *
 * **La largeur est portée par le coup et non par le dessin**, parce qu'elle
 * dépend du zoom au moment où la main l'a tracé. Peindre une côte de près
 * puis s'éloigner pour peindre un golfe doit donner deux largeurs au sol,
 * comme deux pinceaux différents.
 *
 * Elle l'était par le dessin entier, un seul rayon valant pour tous les
 * coups : celui du zoom au moment d'appuyer sur « Terminer ». Personne ne
 * s'en apercevait tant qu'une session durait une minute ; rouvrir un dessin
 * à une autre échelle l'aurait rendu criant, le territoire changeant de
 * forme sans qu'on y touche.
 */
export type Daub = { points: Stroke; metres: number };

export type DrawnPolity = {
  id: string;
  name: string;
  from: number;
  to: number;
  area: number | null;
  /**
   * A coarse outline, for the list to draw.
   *
   * A territory has no photograph and never will; its shape is the only
   * likeness it has. Null only if the geometry could not be simplified to
   * anything, which would be a shape with no area.
   */
  shape: unknown | null;
  /**
   * L'auteur autorise la bibliothèque à le promouvoir dans le fond de carte.
   *
   * Pas de filiation ici, en revanche, et plus jamais : un territoire ne va
   * pas dans une bibliothèque où l'on viendrait le copier. Vérifié, il est
   * promu dans le fond, où tout le monde l'a d'un coup et où chacun peut le
   * masquer — et où la ligne de son auteur disparaît, puisqu'elle y ferait
   * doublon. D'où `stars` et `origin_id` déposées de `drawn_polities`, mais
   * `shared` conservée : ce que le conservateur en fait va plus loin que d'en
   * tirer une entrée. Voir `promote_polity`.
   */
  shared: boolean;
  /**
   * Son tracé a été gardé, donc on peut reprendre le dessin.
   *
   * Faux pour les territoires peints avant que la base ne garde les traits :
   * leur polygone est intact, mais on ne remonte pas d'un polygone à ce qui
   * l'a produit — épaissir une ligne n'a pas d'inverse.
   */
  editable: boolean;
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
 * Chaque coup porte sa propre largeur au sol — voir `Daub` —, et le tracé
 * est rangé avec le territoire : c'est ce qui permet de le reprendre, un
 * polygone ne se défaisant pas en traits.
 *
 * `existing` reprend un territoire au lieu d'en créer un. La base refuse
 * alors d'y toucher s'il n'est pas le vôtre.
 */
export async function drawPolity(options: {
  strokes: Daub[];
  name: string;
  from: number;
  to: number;
  existing?: string | null;
}): Promise<string> {
  const { data, error } = await supabase().rpc("draw_polity", {
    strokes: options.strokes,
    polity_name: options.name.trim(),
    from_year: options.from,
    to_year: options.to,
    existing: options.existing ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Le tracé d'un territoire, pour le reprendre au pinceau.
 *
 * Lu à la demande et non avec la liste : quelques kilo-octets par territoire
 * dont la liste n'a aucun usage, elle qui montre un nom, des années et une
 * silhouette. `null` pour un territoire peint avant que la base ne garde les
 * traits — voir `editable`.
 */
export async function fetchStrokes(id: string): Promise<Daub[] | null> {
  const { data, error } = await supabase().rpc("territory_strokes", {
    wanted: id,
  });
  if (error) throw new Error(error.message);
  return (data as Daub[] | null) ?? null;
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
      shape: unknown | null;
      shared: boolean;
      editable: boolean;
    }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    from: row.start_year,
    to: row.end_year,
    area: row.area,
    shape: row.shape,
    shared: row.shared,
    editable: row.editable,
  }));
}

/** Ouvre un territoire à la bibliothèque, ou l'en soustrait. */
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
