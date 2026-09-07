// React Native's URL implementation is incomplete; supabase-js builds request
// URLs with it. Must be imported before the client is created.
import "react-native-url-polyfill/auto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "../config/env";

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
      // No accounts yet: nothing to persist, and persistence would pull in a
      // storage adapter we do not need.
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export const PHOTO_BUCKET = "event-photos";
