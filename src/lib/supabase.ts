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
