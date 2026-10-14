import { supabase } from "../../lib/supabase";

import type { PlaceCollection } from "./api";

/**
 * Les villes d'un lecteur, et les villes de référence qu'il a ôtées.
 *
 * Les deux dans un fichier parce qu'elles n'ont de sens qu'ensemble : poser
 * sa propre ville là où le fond en a déjà une, c'est presque toujours masquer
 * celle du fond dans la foulée. Les territoires les séparent (`drawn.ts`,
 * `hidden.ts`), mais chacun des deux y pèse dix fois ceci.
 */

export type MyPlace = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  /** L'année de fondation. Toujours là. */
  from: number;
  /** L'année de disparition, ou null pour « elle y est encore ». */
  to: number | null;
  /**
   * L'auteur autorise la bibliothèque à la promouvoir dans le fond de carte.
   *
   * Pas de filiation ici, en revanche, et plus jamais : une ville ne va pas
   * dans une bibliothèque où l'on viendrait la copier. Vérifiée, elle est
   * promue dans le fond, où tout le monde l'a d'un coup et où chacun peut la
   * masquer — et où la ligne de son auteur disparaît, puisqu'elle y ferait
   * doublon. D'où `stars` et `origin_id` déposées de `drawn_places`, mais
   * `shared` conservée : ce que le conservateur en fait va plus loin que d'en
   * tirer une entrée, donc le refus compte davantage ici qu'ailleurs. Voir
   * `promote_place`.
   */
  shared: boolean;
};

/** Un lieu de référence ôté de la carte : son identité chez OHM, et son nom. */
export type MaskedPlace = { ohm: number; name: string | null };

/** Tout ce que ce compte a posé, pour la liste qui les gère. */
export async function fetchMyPlaces(): Promise<MyPlace[]> {
  const { data, error } = await supabase().rpc("my_places");
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as {
      id: string;
      name: string;
      longitude: number;
      latitude: number;
      start_year: number;
      end_year: number | null;
      shared: boolean;
    }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    longitude: row.longitude,
    latitude: row.latitude,
    from: row.start_year,
    to: row.end_year,
    shared: row.shared,
  }));
}

/**
 * Pose une ville. Rien n'est calculé : un point est un point.
 *
 * Par un écrit direct et non par une fonction, contrairement aux territoires
 * — ceux-là font épaissir, fondre et réparer leur géométrie par PostGIS avant
 * d'exister. Ici la politique de la table suffit, et le propriétaire est
 * estampillé par le défaut de la colonne.
 */
export async function addPlace(place: {
  name: string;
  longitude: number;
  latitude: number;
  from: number;
  to: number | null;
}): Promise<void> {
  const { error } = await supabase().from("drawn_places").insert({
    name: place.name.trim(),
    longitude: place.longitude,
    latitude: place.latitude,
    start_year: place.from,
    end_year: place.to,
  });
  if (error) throw new Error(error.message);
}

/** Ouvre une ville à la bibliothèque, ou l'en soustrait. */
export async function sharePlace(id: string, shared: boolean): Promise<void> {
  const { error } = await supabase()
    .from("drawn_places")
    .update({ shared })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function erasePlace(id: string): Promise<void> {
  const { error } = await supabase().from("drawn_places").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Les villes de ce lecteur en vigueur telle année, prêtes pour la planche. */
export async function fetchMyPlacesAt(year: number): Promise<PlaceCollection> {
  const { data, error } = await supabase().rpc("drawn_places_at", {
    at_year: year,
  });
  if (error) throw new Error(error.message);
  return data as PlaceCollection;
}

/** Ce que ce compte a ôté de sa carte, le plus récent d'abord. */
export async function fetchMaskedPlaces(): Promise<MaskedPlace[]> {
  const { data, error } = await supabase().rpc("my_hidden_places");
  if (error) throw new Error(error.message);
  return ((data ?? []) as { ohm_id: number; name: string | null }[]).map(
    (row) => ({ ohm: row.ohm_id, name: row.name }),
  );
}

export async function maskPlace(ohm: number): Promise<void> {
  const { error } = await supabase()
    .from("hidden_places")
    .insert({ ohm_id: ohm });
  if (error) throw new Error(error.message);
}

export async function unmaskPlace(ohm: number): Promise<void> {
  const { error } = await supabase()
    .from("hidden_places")
    .delete()
    .eq("ohm_id", ohm);
  if (error) throw new Error(error.message);
}
