// React Native's URL implementation is incomplete; supabase-js builds request
// URLs with it. Must be imported before the client is created.
import "react-native-url-polyfill/auto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "../config/env";
import { sessionStore } from "./sessionStore";

let client: SupabaseClient | null = null;

/**
 * Lazily built so a missing `.env` surfaces as an explained screen rather than
 * a crash while the module graph is still loading.
 */
export function supabase(): SupabaseClient {
  if (!client) {
    if (!env.hasSupabase) {
      throw new Error("Supabase is not configured — see .env.example");
    }
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: sessionStore,
        // Signed in once, signed in until they say otherwise: the session is
        // written to the device and the access token renewed behind their back.
        persistSession: true,
        autoRefreshToken: true,
        // A phone has no URL to read a session out of; leaving this on makes
        // supabase-js poke at `window.location`, which does not exist here.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export const PHOTO_BUCKET = "event-photos";

/**
 * The signed-in account, for the one thing the database cannot stamp itself:
 * the path a picture is filed under.
 *
 * Rows get their owner from a column default; objects in a bucket have no
 * columns, so the account has to be written into the path — that is what the
 * storage policies read to keep one reader out of another's files. Taken from
 * the stored session rather than from the network: it is already on the device,
 * and an upload should not wait on a round trip to learn who is uploading.
 */
export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase().auth.getSession();
  if (error) throw new Error(error.message);
  const id = data.session?.user.id;
  if (!id) throw new Error("Session expirée — reconnectez-vous pour envoyer une photo.");
  return id;
}
