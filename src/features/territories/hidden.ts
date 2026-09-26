import { supabase } from "../../lib/supabase";

/**
 * The territories a reader has taken off their own map.
 *
 * `polities` is reference data — twelve thousand versions of fifteen hundred
 * entities, loaded from Cliopatria and shared by every account. Nobody may
 * delete from it, so "remove this from my map" is a mask held per account and
 * applied when the map asks which territories are in force.
 *
 * Masked **by name**, not by row: an entity exists in a dozen versions across
 * the centuries, and nobody wants the Abbasid Caliphate gone from 900 to 950
 * and back for 950 to 1000.
 */

/** Every name this account has hidden, in the order they were hidden. */
export async function fetchHiddenPolities(): Promise<string[]> {
  const { data, error } = await supabase()
    .from("hidden_polities")
    .select("name")
    .order("hidden_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { name: string }[]).map((row) => row.name);
}

export async function hidePolity(name: string): Promise<void> {
  // The owner is stamped by the column's default, as everywhere else.
  const { error } = await supabase().from("hidden_polities").insert({ name });
  if (error) throw new Error(error.message);
}

export async function showPolity(name: string): Promise<void> {
  const { error } = await supabase()
    .from("hidden_polities")
    .delete()
    .eq("name", name);
  if (error) throw new Error(error.message);
}
