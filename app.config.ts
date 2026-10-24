import type { ConfigContext, ExpoConfig } from "expo/config";

import { VARIANTS, variantOf } from "./src/config/variants";

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

/**
 * Lue dans l'environnement, avec `production` par défaut.
 *
 * Le préfixe `EXPO_PUBLIC_` n'est pas décoratif : il permet à l'application
 * elle-même de lire la même valeur au moment de l'exécution, et donc de
 * construire le lien de retour avec le schéma de sa propre variante. Une seule
 * source, deux lecteurs, aucun désaccord possible.
 */
const variante = VARIANTS[variantOf(process.env.EXPO_PUBLIC_APP_VARIANT)];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  name: variante.name,
  scheme: variante.scheme,
  ios: {
    ...config.ios,
    bundleIdentifier: `com.mapshistory.app${variante.suffix}`,
  },
  android: {
    ...config.android,
    package: `com.mapshistory.app${variante.suffix}`,
  },
});
