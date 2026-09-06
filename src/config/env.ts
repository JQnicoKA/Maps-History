/**
 * Runtime configuration read from `.env` (see `.env.example`).
 *
 * Expo inlines `EXPO_PUBLIC_*` variables into the bundle at build time, so they
 * must be referenced with static dot notation — `process.env[name]` is not
 * replaced by the bundler and always resolves to `undefined`.
 */
const maptilerApiKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim() ?? "";

export const env = {
  maptilerApiKey,
  hasMapTilerApiKey: maptilerApiKey.length > 0,
} as const;
