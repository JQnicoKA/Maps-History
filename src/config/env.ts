/**
 * Runtime configuration read from `.env` (see `.env.example`).
 *
 * Expo inlines `EXPO_PUBLIC_*` variables into the bundle at build time, so they
 * must be referenced with static dot notation — `process.env[name]` is not
 * replaced by the bundler and always resolves to `undefined`.
 */
import { VARIANTS, variantOf } from "./variants";

const maptilerApiKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim() ?? "";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? "";

/**
 * Notre propre archive PMTiles du fond de carte, si nous en avons une.
 *
 * Vide — et c'est le cas par défaut — le fond vient de MapTiler, tuile par
 * tuile. Renseignée, MapLibre lit des tranches d'octets dans ce fichier
 * unique et plus une seule requête de fond ne part chez MapTiler. Voir
 * `docs/brancher-les-tuiles.md`.
 */
const tilesUrl = process.env.EXPO_PUBLIC_TILES_URL?.trim() ?? "";

/**
 * Laquelle des trois applications s'exécute — `app.config.ts` lit la même
 * variable pour décider du nom, de l'identifiant et du schéma d'URL.
 *
 * Le schéma est reconstruit ici plutôt que codé en dur : une build de
 * développement doit renvoyer les liens vers *elle-même*, et non vers la
 * version de l'App Store installée à côté.
 */
/**
 * Google et Facebook, par le navigateur : rien à lire côté application.
 *
 * Leurs identifiants vivent chez Supabase, qui mène toute la danse. Il reste
 * à savoir si chaque fournisseur est branché, et seules ces variables peuvent
 * le dire — l'apprendre en interrogeant Supabase demanderait un aller-retour
 * avant d'avoir dessiné le bouton.
 *
 * **Google n'a pas toujours été ainsi.** Il fut tenté en natif, avec un
 * identifiant par plateforme ; la feuille native s'est révélée incompatible
 * avec Supabase — voir le commentaire de `nonceOf` dans `features/auth`. Le
 * navigateur n'a besoin de rien.
 */
const googleLogin = (process.env.EXPO_PUBLIC_GOOGLE_LOGIN?.trim() ?? "") === "1";

/**
 * Facebook n'a rien à lire côté application.
 *
 * Son identifiant et son secret vivent chez Supabase, qui mène toute la danse
 * dans le navigateur du système. Il reste à savoir si le fournisseur est
 * branché, et seule cette variable peut le dire : l'apprendre en interrogeant
 * Supabase demanderait un aller-retour avant d'avoir dessiné le bouton.
 */
const facebookLogin = (process.env.EXPO_PUBLIC_FACEBOOK_LOGIN?.trim() ?? "") === "1";

/* Le schéma vient de la table partagée avec `app.config.ts`, et non d'un nom
   recollé ici : les deux ont divergé une fois — voir `variants.ts`. */
const variant = variantOf(process.env.EXPO_PUBLIC_APP_VARIANT);
const scheme = VARIANTS[variant].scheme;

export const env = {
  maptilerApiKey,
  hasMapTilerApiKey: maptilerApiKey.length > 0,
  supabaseUrl,
  supabaseAnonKey,
  hasSupabase: supabaseUrl.length > 0 && supabaseAnonKey.length > 0,
  sentryDsn,
  /** Without it, nothing is reported and nothing else changes. */
  hasSentry: sentryDsn.length > 0,
  tilesUrl,
  /** Faux = on lit MapTiler. Un seul interrupteur, et il se vide. */
  hasOwnTiles: tilesUrl.length > 0,
  hasGoogleLogin: googleLogin,
  hasFacebookLogin: facebookLogin,
  variant,
  scheme,
} as const;
