import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import {
  APPLE_POSSIBLE,
  signInWith,
  type SocialProvider,
} from "./social";
import { PRIVACY_URL, TERMS_URL } from "../../config/contact";
import { env } from "../../config/env";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

export type SocialSignInProps = {
  /**
   * La quatrième porte : celle qui ouvre le formulaire.
   *
   * Elle est ici et non à côté pour une raison de mise en page autant que de
   * sens : quatre portes au même niveau se comparent d'un regard, et elles
   * doivent pour cela partager leur hauteur, leur rayon et leur marque. Trois
   * dessinées ici et une dessinée ailleurs finiraient par diverger.
   */
  onEmail: () => void;
  /** Le formulaire travaille déjà : on ne lance pas deux connexions. */
  disabled?: boolean;
  /** Prévient pendant qu'une feuille est ouverte, pour griser le reste. */
  onBusyChange?: (busy: boolean) => void;
  /** Ce qui a échoué, en une phrase, ou `null` quand on recommence. */
  onProblem: (problem: string | null) => void;
};

/** La marque d'une porte, dessinée plutôt que chargée. */
function Mark({ which }: { which: "google" | "facebook" | "email" }) {
  return (
    <View style={styles.mark}>
      <Text
        style={[
          styles.markLetter,
          which === "google"
            ? styles.letterGoogle
            : which === "facebook"
              ? styles.letterFacebook
              : styles.letterEmail,
        ]}
      >
        {which === "google" ? "G" : which === "facebook" ? "f" : "@"}
      </Text>
    </View>
  );
}

/**
 * Les trois portes qui n'ont pas de mot de passe.
 *
 * **Au-dessus du formulaire, et c'est voulu** : c'est le chemin le plus court,
 * et celui qui ne demande rien à retenir. Le formulaire reste entier
 * au-dessous, pour qui préfère une adresse et un mot de passe — ou pour qui
 * n'a aucun de ces trois comptes.
 *
 * Chaque bouton ne paraît que si son fournisseur est branché : Apple sur iOS
 * et seulement là où le système sait le faire, Google si ses deux identifiants
 * sont dans `.env`, Facebook si on l'a déclaré. Un bouton qui échoue à tous les
 * coups est pire qu'un bouton absent — le lecteur croit que son compte est en
 * cause.
 */
export function SocialSignIn({
  onEmail,
  disabled = false,
  onBusyChange,
  onProblem,
}: SocialSignInProps) {
  /**
   * Apple répond à l'exécution, pas à la compilation.
   *
   * `APPLE_POSSIBLE` écarte Android sans rien demander ; cette vérification-ci
   * est celle du système, qui dit si la feuille existe vraiment sur cet
   * appareil. `undefined` tant qu'on ne sait pas : dessiner le bouton puis le
   * retirer ferait sauter la mise en page sous les yeux.
   */
  const [apple, setApple] = useState<boolean | undefined>(undefined);
  const [working, setWorking] = useState<SocialProvider | null>(null);

  useEffect(() => {
    if (!APPLE_POSSIBLE) {
      setApple(false);
      return;
    }
    let alive = true;
    void AppleAuthentication.isAvailableAsync().then((can) => {
      if (alive) setApple(can);
    });
    return () => {
      alive = false;
    };
  }, []);

  const run = async (provider: SocialProvider) => {
    onProblem(null);
    setWorking(provider);
    onBusyChange?.(true);
    try {
      await signInWith(provider);
      /* Rien à faire de plus : `onAuthStateChange` tient la suite, et la
         coquille échange l'écran de connexion contre la carte. */
    } catch (cause) {
      onProblem(
        cause instanceof Error
          ? cause.message
          : "La connexion n'a pas abouti. Réessayez.",
      );
    } finally {
      setWorking(null);
      onBusyChange?.(false);
    }
  };

  const busy = disabled || working !== null;

  return (
    <View style={styles.all}>
      {apple === true ? (
        /* Le bouton d'Apple et non le nôtre : ses règles l'imposent, jusqu'au
           dessin de la pomme et à la formule. On ne règle que le rayon, pour
           qu'il ait le coin des boutons d'à côté. */
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.md}
          style={styles.apple}
          onPress={() => {
            if (!busy) void run("apple");
          }}
        />
      ) : null}

      {env.hasGoogleLogin ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continuer avec Google"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void run("google")}
          style={({ pressed }) => [
            styles.door,
            styles.google,
            pressed && styles.dim,
            busy && styles.waiting,
          ]}
        >
          <Mark which="google" />
          <Text style={[styles.label, styles.labelGoogle]}>
            {working === "google" ? "…" : "Continuer avec Google"}
          </Text>
        </Pressable>
      ) : null}

      {env.hasFacebookLogin ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continuer avec Facebook"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void run("facebook")}
          style={({ pressed }) => [
            styles.door,
            styles.facebook,
            pressed && styles.dim,
            busy && styles.waiting,
          ]}
        >
          <Mark which="facebook" />
          <Text style={[styles.label, styles.labelFacebook]}>
            {working === "facebook" ? "…" : "Continuer avec Facebook"}
          </Text>
        </Pressable>
      ) : null}

      {/* La porte de l'atlas, dans l'étoffe de l'atlas.
          Dernière des quatre parce qu'elle est la plus longue à franchir —
          une adresse, un mot de passe, parfois un courriel à aller ouvrir —
          et qu'on offre d'abord ce qui prend un geste. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continuer avec une adresse mail"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onEmail}
        style={({ pressed }) => [
          styles.door,
          styles.email,
          pressed && styles.dim,
          busy && styles.waiting,
        ]}
      >
        <Mark which="email" />
        <Text style={[styles.label, styles.labelEmail]}>
          Continuer avec une adresse mail
        </Text>
      </Pressable>

      {/* Entrer par l'une de ces portes **crée un compte** quand on n'en a
          pas. Le formulaire d'inscription fait cocher les conditions ; les
          trois autres n'ont rien à cocher, et les rappeler sous les quatre est
          la façon ordinaire de les faire accepter. */}
      <Text style={styles.pact}>
        En continuant, vous acceptez les{" "}
        <Text style={styles.link} onPress={() => void Linking.openURL(TERMS_URL)}>
          conditions d'utilisation
        </Text>{" "}
        et la{" "}
        <Text style={styles.link} onPress={() => void Linking.openURL(PRIVACY_URL)}>
          politique de confidentialité
        </Text>
        .
      </Text>

    </View>
  );
}

/** La hauteur commune des trois portes. */
const DOOR = 48;

const styles = StyleSheet.create({
  all: { gap: space.sm },
  /** Le bouton d'Apple n'a pas de taille à lui : sans ces deux lignes, il ne
      se dessine pas du tout. */
  apple: { width: "100%", height: DOOR },
  door: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    height: DOOR,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    ...shadow.soft,
  },
  /** Le rouge de Google, plein et sans filet. */
  google: { backgroundColor: "#FA4335" },
  /** Le bleu de Facebook, qui est le sien et non celui de l'atlas. */
  facebook: { backgroundColor: "#1877F2" },
  /**
   * Le gris de l'atlas : la seule porte qui soit à nous.
   *
   * **Grise et non noire**, depuis que l'encre l'est : la feuille d'Apple,
   * juste au-dessus, est noire elle aussi, et deux portes de la même couleur
   * à deux lignes d'écart se lisaient comme une seule. Le gris doux en est
   * séparé de 3,1 contre 1 — assez pour qu'on voie deux objets — et porte le
   * blanc à 6,7.
   */
  email: { backgroundColor: palette.inkSoft },
  dim: { opacity: 0.7 },
  waiting: { opacity: 0.5 },
  label: { ...type.body, fontWeight: "600" },
  labelGoogle: { color: "#FFFFFF" },
  labelFacebook: { color: "#FFFFFF" },
  labelEmail: { color: palette.surfaceRaised },
  /** Toujours blanche : elle se pose sur du noir, du blanc, du bleu et de
      l'encre, et une marque qui changerait de fond avec sa porte ne se
      lirait plus comme la même espèce d'objet. */
  mark: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  markLetter: { fontSize: 17, fontWeight: "800", lineHeight: 21 },
  letterGoogle: { color: "#4285F4" },
  letterFacebook: { color: "#1877F2" },
  letterEmail: { color: palette.ink },
  pact: { ...type.caption, color: palette.inkFaint, marginTop: space.xs },
  link: { color: palette.wax, fontWeight: "600" },
});
