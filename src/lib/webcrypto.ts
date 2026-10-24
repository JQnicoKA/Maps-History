import * as Crypto from "expo-crypto";

/**
 * Le seul morceau de WebCrypto dont `supabase-js` ait besoin.
 *
 * **Sans lui, PKCE tourne en mode dégradé.** La bibliothèque calcule le défi
 * PKCE ainsi :
 *
 * ```js
 * const hasCryptoSupport =
 *   typeof crypto !== "undefined" &&
 *   typeof crypto.subtle !== "undefined" &&
 *   typeof TextEncoder !== "undefined";
 * if (!hasCryptoSupport) return verifier;   // ← « plain »
 * ```
 *
 * Elle avertit, puis **renvoie le vérificateur lui-même** comme défi. Or tout
 * l'intérêt de PKCE est que le défi ne permette pas de retrouver le
 * vérificateur : en `plain`, quiconque voit passer la demande d'autorisation
 * tient de quoi échanger un code volé. La RFC 7636 est explicite — S256 doit
 * être employé dès qu'un client en est capable. React Native en est capable,
 * il lui manquait seulement l'interface.
 *
 * `crypto.getRandomValues` existe déjà dans Hermes — c'est lui qui tire le
 * vérificateur, et son absence ferait échouer la connexion au lieu de
 * l'affaiblir. Il ne manque donc que `subtle`.
 *
 * **Ce `subtle` est partiel, et on sait exactement ce que cela coûte.**
 *
 * `supabase-js` demande trois choses à WebCrypto : `digest`, pour le défi
 * PKCE, puis `importKey` et `verify`, pour vérifier un JWT **localement** dans
 * `auth.getClaims()`. Et il décide s'il peut le faire ainsi :
 *
 * ```js
 * 'crypto' in globalThis && 'subtle' in globalThis.crypto
 * ```
 *
 * Installer un `subtle` incomplet lui fait donc répondre oui à une question à
 * laquelle il faudrait répondre à moitié : `getClaims()` cesse de se replier
 * sur un appel réseau à `getUser()` et part vers un `importKey` qui n'existe
 * pas.
 *
 * **Vérifié avant de faire ce choix** : `getClaims()` n'est appelé nulle part
 * — ni par cette application, ni par `supabase-js` lui-même, ni par
 * `postgrest-js`, `realtime-js` ou `storage-js`. C'est une interface récente et
 * facultative. Le marché est donc : S256 pour toutes les connexions et toutes
 * les réinitialisations, contre une méthode que personne n'appelle.
 *
 * Et pour que ce marché ne se retourne pas en silence, `importKey` et `verify`
 * sont **présents et parlants** : qui appellera `getClaims()` un jour lira une
 * phrase qui nomme ce fichier, au lieu de chercher pourquoi une fonction est
 * `undefined`. Il faudra alors un vrai polyfill — `react-native-quick-crypto`
 * — et ce fichier disparaîtra.
 */

/** `digest` accepte une chaîne ou un objet `{ name }` ; les deux arrivent. */
type Algorithm = string | { name: string };

function nameOf(algorithm: Algorithm): string {
  return typeof algorithm === "string" ? algorithm : algorithm.name;
}

const SUPPORTED: Record<string, Crypto.CryptoDigestAlgorithm> = {
  "SHA-1": Crypto.CryptoDigestAlgorithm.SHA1,
  "SHA-256": Crypto.CryptoDigestAlgorithm.SHA256,
  "SHA-384": Crypto.CryptoDigestAlgorithm.SHA384,
  "SHA-512": Crypto.CryptoDigestAlgorithm.SHA512,
};

export function installWebCryptoDigest(): void {
  const where = globalThis as typeof globalThis & {
    crypto?: { subtle?: unknown };
  };

  // Rien à faire là où l'interface existe déjà — un navigateur, un test.
  if (!where.crypto || where.crypto.subtle) return;

  /**
   * Ce que ce complément ne sait pas faire, dit en une phrase utile.
   *
   * Posée plutôt que laissée absente : absente, l'appelant bute sur
   * « undefined is not a function » et remonte une pile qui ne nomme rien.
   */
  const unsupported = (what: string) => (): never => {
    throw new Error(
      `crypto.subtle.${what} n'est pas disponible : src/lib/webcrypto.ts ne ` +
        `fournit que digest, ce dont PKCE a besoin. Pour vérifier un JWT ` +
        `localement — auth.getClaims() —, il faut un vrai polyfill WebCrypto, ` +
        `par exemple react-native-quick-crypto.`,
    );
  };

  const subtle = {
    digest: async (
      algorithm: Algorithm,
      data: BufferSource,
    ): Promise<ArrayBuffer> => {
      const wanted = SUPPORTED[nameOf(algorithm)];
      if (!wanted) {
        throw new Error(`Algorithme non pris en charge : ${nameOf(algorithm)}`);
      }
      return Crypto.digest(wanted, data);
    },
    importKey: unsupported("importKey"),
    verify: unsupported("verify"),
  };

  try {
    Object.defineProperty(where.crypto, "subtle", {
      value: subtle,
      configurable: true,
      enumerable: false,
      writable: false,
    });
  } catch {
    /* `crypto` est parfois gelé selon le moteur. L'avertissement de
       `supabase-js` reparaîtra alors, ce qui est exactement ce qu'il faut :
       il dira la vérité sur ce qui tourne. */
  }
}
