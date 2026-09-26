import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Trois applications, un seul code.
 *
 * iOS n'identifie pas une application par son nom mais par son *bundle
 * identifier* : deux builds qui le partagent sont, pour le téléphone, la même
 * app — la seconde installée écrase la première, sa session et ses réglages
 * compris. C'est ce qui est arrivé quand la build TestFlight a remplacé la
 * build de développement.
 *
 * Chaque variante reçoit donc son identifiant, son nom sur l'écran d'accueil
 * et son schéma d'URL. Les trois cohabitent, et on sait au premier coup d'œil
 * laquelle on ouvre.
 *
 * Le schéma compte autant que le reste : il porte les liens de réinitialisation
 * de mot de passe. Si deux variantes le partageaient, iOS choisirait
 * arbitrairement laquelle ouvrir — et le lien atterrirait une fois sur deux
 * dans la mauvaise.
 */
const VARIANTES = {
  development: {
    suffixe: ".dev",
    nom: "HistoryNote dev",
    schema: "mapshistory-dev",
  },
  preview: {
    suffixe: ".preview",
    nom: "HistoryNote test",
    schema: "mapshistory-preview",
  },
  production: {
    suffixe: "",
    nom: "HistoryNote",
    schema: "mapshistory",
  },
} as const;

type Variante = keyof typeof VARIANTES;

/**
 * Lue dans l'environnement, avec `production` par défaut.
 *
 * Le préfixe `EXPO_PUBLIC_` n'est pas décoratif : il permet à l'application
 * elle-même de lire la même valeur au moment de l'exécution, et donc de
 * construire le lien de retour avec le schéma de sa propre variante. Une seule
 * source, deux lecteurs, aucun désaccord possible.
 */
const choisie = (process.env.EXPO_PUBLIC_APP_VARIANT ?? "production") as Variante;
const variante = VARIANTES[choisie] ?? VARIANTES.production;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  name: variante.nom,
  scheme: variante.schema,
  ios: {
    ...config.ios,
    bundleIdentifier: `com.mapshistory.app${variante.suffixe}`,
  },
  android: {
    ...config.android,
    package: `com.mapshistory.app${variante.suffixe}`,
  },
});
