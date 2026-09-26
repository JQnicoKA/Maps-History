/**
 * Runtime configuration read from `.env` (see `.env.example`).
 *
 * Expo inlines `EXPO_PUBLIC_*` variables into the bundle at build time, so they
 * must be referenced with static dot notation — `process.env[name]` is not
 * replaced by the bundler and always resolves to `undefined`.
 */
const maptilerApiKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim() ?? "";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? "";

/**
 * Laquelle des trois applications s'exécute — `app.config.ts` lit la même
 * variable pour décider du nom, de l'identifiant et du schéma d'URL.
 *
 * Le schéma est reconstruit ici plutôt que codé en dur : une build de
 * développement doit renvoyer les liens vers *elle-même*, et non vers la
 * version de l'App Store installée à côté.
 */
const variant = process.env.EXPO_PUBLIC_APP_VARIANT?.trim() || "production";
const scheme =
  variant === "production" ? "mapshistory" : `mapshistory-${variant}`;

export const env = {
  maptilerApiKey,
  hasMapTilerApiKey: maptilerApiKey.length > 0,
  supabaseUrl,
  supabaseAnonKey,
  hasSupabase: supabaseUrl.length > 0 && supabaseAnonKey.length > 0,
  sentryDsn,
  /** Without it, nothing is reported and nothing else changes. */
  hasSentry: sentryDsn.length > 0,
  variant,
  scheme,
} as const;
