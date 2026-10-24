import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { env } from "../../config/env";
import { supabase } from "../../lib/supabase";

/** Les trois façons d'entrer sans mot de passe. */
export type SocialProvider = "apple" | "google" | "facebook";

/**
 * Ce qu'une tentative rend.
 *
 * **Refermer la feuille n'est pas une panne**, et c'est la raison d'être de ce
 * type. Un refus qui remonterait en exception ferait afficher « Connexion
 * impossible » à quelqu'un qui a simplement changé d'avis — et il chercherait
 * ce qui ne va pas chez lui. Les vraies pannes, elles, sont bien des
 * exceptions.
 */
export type SocialResult = "signed-in" | "cancelled";

/**
 * Où le navigateur revient après Facebook.
 *
 * **Pas le même chemin que la réinitialisation de mot de passe**, qui revient
 * sur `://reset` — voir `AuthProvider`. Le lecteur de liens de ce fichier-là
 * échange le code puis lève `recovering`, ce qui enferme le lecteur sur
 * l'écran « choisissez un mot de passe ». Une connexion Facebook qui
 * reviendrait par la même porte serait donc prise pour une réinitialisation,
 * et demanderait un mot de passe à quelqu'un qui vient précisément de se
 * connecter sans.
 *
 * Chaque variante a son schéma, et **chacun doit être déclaré chez Supabase**,
 * sous Authentication → URL Configuration → Redirect URLs.
 */
export const OAUTH_RETURN = `${env.scheme}://auth`;

/**
 * Le nonce que le jeton porte, s'il en porte un.
 *
 * **Un garde-fou, pas un mécanisme — et il a une histoire.** Supabase vérifie
 * ainsi le jeton qu'on lui tend :
 *
 * ```go
 * hash := fmt.Sprintf("%x", sha256.Sum256([]byte(params.Nonce)))
 * if hash != idToken.Nonce { return "Nonces mismatch" }
 * ```
 *
 * Il veut donc le nonce **en clair dont le jeton porte l'empreinte**, et il
 * refuse aussi qu'un seul des deux existe. La connexion Google native s'y est
 * brisée : `AppAuth`, deux couches sous le module, pose un nonce d'office et
 * en clair dans le jeton ; il aurait fallu en connaître la préimage, c'est-à-
 * dire inverser SHA-256. Google passe depuis par le navigateur, où la
 * question ne se pose pas.
 *
 * Reste Apple, qui n'ajoute rien tant qu'on ne lui demande rien. Ceci ne fait
 * donc rien aujourd'hui, et transmettra le nonce le jour où une mise à jour
 * native changera d'avis — ce qui évitera de rechercher une seconde fois ce
 * qu'on a mis une soirée à trouver.
 */
function nonceOf(token: string): string | undefined {
  try {
    const body = token.split(".")[1];
    if (!body) return undefined;
    const claims = JSON.parse(
      atob(body.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { nonce?: unknown };
    return typeof claims.nonce === "string" ? claims.nonce : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Apple, par la feuille du système.
 *
 * Le jeton d'identité est signé par Apple et vérifié par Supabase : rien ne
 * transite par un navigateur, et le lecteur n'a pas de mot de passe à taper.
 *
 * **Le nom et l'adresse ne sont donnés qu'à la toute première connexion**, et
 * le lecteur peut les refuser — l'adresse est alors un relais privé en
 * `@privaterelay.appleid.com`, qui fonctionne comme une vraie adresse. Rien ici
 * n'en dépend : c'est le jeton qui fait foi, et Supabase en tire le compte.
 */
export async function signInWithApple(): Promise<SocialResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("Apple n'a pas renvoyé de jeton d'identité.");
    }

    /* Le même garde-fou que pour Google, et pour la même raison : si la
       couche native pose un nonce un jour, Supabase le réclamera des deux
       côtés. Apple n'en met pas tant qu'on ne lui en demande pas, donc ceci
       ne fait rien aujourd'hui — et évite la même soirée de recherche. */
    const nonce = nonceOf(credential.identityToken);
    const { error } = await supabase().auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      ...(nonce === undefined ? {} : { nonce }),
    });
    if (error) throw new Error(error.message);
    return "signed-in";
  } catch (cause) {
    if (
      typeof cause === "object" &&
      cause !== null &&
      (cause as { code?: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      return "cancelled";
    }
    throw cause;
  }
}


/**
 * Google et Facebook, par le navigateur du système.
 *
 * `openAuthSessionAsync` ouvre une vue du système —
 * `ASWebAuthenticationSession` sur iOS, un onglet personnalisé sur Android —
 * qui **partage les cookies du navigateur** : quelqu'un déjà connecté à son
 * compte n'a rien à retaper, il choisit et revient. Ce n'est pas une vue web
 * embarquée, que Google refuserait ; c'est le navigateur lui-même, et c'est
 * ce que Google demande.
 *
 * C'est cette vue qui intercepte le retour, et non le système de liens : elle
 * rend l'URL elle-même. Le code y est échangé contre une session, exactement
 * comme le fait le lien de réinitialisation.
 */
async function throughBrowser(
  provider: "google" | "facebook",
): Promise<SocialResult> {
  const { data, error } = await supabase().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: OAUTH_RETURN,
      /* Sans cela, supabase-js essaierait d'emmener `window.location`
         ailleurs — ce qui n'existe pas ici. On veut l'adresse, pas le
         voyage. */
      skipBrowserRedirect: true,
    },
  });
  if (error) throw new Error(error.message);
  if (!data.url) throw new Error("Supabase n'a pas renvoyé d'adresse de connexion.");

  /* Diagnostic : l'adresse de retour que l'application réclame vraiment. Elle
     n'a rien de secret — c'est notre propre schéma —, et elle départage « la
     liste blanche de Supabase la refuse » de « le serveur a échoué pour une
     autre raison et renvoie vers le site du projet ». */
  console.log(
    "[diagnostic] retour demandé :",
    new URL(data.url).searchParams.get("redirect_to"),
  );

  const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_RETURN);
  if (result.type !== "success") return "cancelled";

  const back = new URL(result.url);
  const refused =
    back.searchParams.get("error_description") ?? back.searchParams.get("error");
  if (refused) throw new Error(refused);

  const code = back.searchParams.get("code");
  if (!code) {
    throw new Error(`${provider} n'a pas renvoyé de code de connexion.`);
  }

  const { error: exchange } = await supabase().auth.exchangeCodeForSession(code);
  if (exchange) throw new Error(exchange.message);
  return "signed-in";
}

export const signInWithGoogle = (): Promise<SocialResult> =>
  throughBrowser("google");

export const signInWithFacebook = (): Promise<SocialResult> =>
  throughBrowser("facebook");

export async function signInWith(provider: SocialProvider): Promise<SocialResult> {
  if (provider === "apple") return signInWithApple();
  if (provider === "google") return signInWithGoogle();
  return signInWithFacebook();
}

/**
 * Apple n'est offert que là où il existe.
 *
 * iOS 13 et au-delà, et jamais sur Android — où la feuille n'existe pas et où
 * le bouton n'aurait rien à ouvrir. La vérification est asynchrone côté
 * système ; ce drapeau-ci est le préalable, bon marché, qui évite de la poser.
 */
export const APPLE_POSSIBLE = Platform.OS === "ios";

