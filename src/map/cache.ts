import { OfflineManager } from "@maplibre/maplibre-react-native";

import { TILE_CACHE_BYTES } from "../config/map";

/**
 * Agrandir le cache de tuiles, à chaque démarrage.
 *
 * « À chaque démarrage » n'est pas une négligence : le réglage ne survit pas à
 * la fermeture de l'application, il faut donc le reposer. C'est aussi pourquoi
 * il vit ici et non dans un écran — c'est une propriété du processus, pas
 * d'une vue.
 *
 * Silencieux en cas d'échec, et volontairement : un cache qui refuse de
 * s'agrandir coûte des requêtes, pas une panne, et rien ne justifierait
 * d'empêcher la carte de s'ouvrir pour ça.
 */
export async function holdMoreTiles(): Promise<void> {
  try {
    await OfflineManager.setMaximumAmbientCacheSize(TILE_CACHE_BYTES);
  } catch {
    // Rien à dire au lecteur, qui n'a rien demandé.
  }
}
