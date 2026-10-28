import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

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

/**
 * Les marques officielles, telles qu'elles nous sont données.
 *
 * **Elles furent trois lettres dessinées** — un `G`, un `f` et un `@` en
 * `<Text>` coloré. C'était commode et c'était un ersatz : Google et Meta
 * publient tous deux des règles d'identité qui exigent leurs fichiers, non
 * redessinés, non recolorés. Ce n'est pas une exigence esthétique mais une
 * condition d'usage de leur connexion, et un bouton non conforme est un motif
 * de rejet à la revue de l'App Store.
 *
 * Le `@` reste dessiné : il n'appartient à personne.
 *
 * Prises dans l'archive d'identité de Google (variante iOS, **thème neutre**,
 * sans texte, carrée) et au Brand Resource Centre de Meta (logo secondaire,
 * le `f` blanc, celui qui se pose sur leur bleu). Leur provenance exacte et la
 * façon dont le `G` a été préparé sont dans `assets/marques-officielles.md`.
 */
/**
 * La boîte d'une marque, portée de vingt-deux à vingt-quatre.
 *
 * **Et surtout, le `G` a été détouré de sa tuile.** Le fichier de Google est
 * un carré de thème clair avec le `G` au milieu, et le `G` n'y occupe que
 * **45 % de la largeur** — mesuré sur leur image, boîte de 59 pixels dans une
 * tuile de 132. Posée dans une boîte de vingt-deux points, la marque ne
 * faisait donc dix points que de tuile, et le `G` lui-même à peine dix. D'où
 * la plainte, et elle était juste.
 *
 * Recadré sur le `G` seul, c'est la marque entière qui occupe la boîte. Rien
 * n'a été redessiné ni recoloré : seul le pourtour de la tuile a été ôté.
 *
 * **Et la tuile est celle du thème neutre, non du thème clair.** Recadrer ne
 * retire que le bord, pas le fond : la tuile claire est blanche à l'intérieur,
 * et le `G` paraissait donc dans un carré blanc posé sur le gris du bouton.
 * La tuile neutre est remplie de `#F2F2F2`, c'est-à-dire exactement la couleur
 * du bouton — la jonction ne se voit plus, et c'est la présentation même du
 * bouton Neutral de Google.
 *
 * Cela lie le fichier au fond : changer `google.backgroundColor` sans reprendre
 * la tuile ferait réapparaître le carré.
 */
const MARK = 24;

const GOOGLE_G = require("../../../assets/google-g.png");
const FACEBOOK_F = require("../../../assets/facebook-f.png");

function Mark({ which }: { which: "google" | "facebook" | "email" }) {
  if (which === "email") {
    return (
      <View style={styles.mark}>
        <Text style={[styles.markLetter, styles.letterEmail]}>@</Text>
      </View>
    );
  }

  return (
    <Image
      source={which === "google" ? GOOGLE_G : FACEBOOK_F}
      /* Les deux dimensions nommées, toujours : `Image` pose celles du
         fichier avant les vôtres, et une dimension tue reste celle de
         l'asset — ici 44 points pour le `G` et 2 084 pour le `f`. */
      style={styles.markImage}
      resizeMode="contain"
      accessible={false}
    />
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
  /**
   * Le gris neutre de Google, et un filet emprunté à leur thème clair.
   *
   * Il fut `#FA4335`, choisi parce qu'il tenait bien à côté du bleu de
   * Facebook. Mais Google n'autorise que trois fonds pour sa marque : blanc
   * `#FFFFFF`, neutre `#F2F2F2`, sombre `#131314`. Le sombre vaut la porte
   * d'Apple à 1,03 contre 1 — deux portes qu'on lirait comme une seule, le
   * défaut même que le fond d'`email` a été introduit pour corriger.
   *
   * **Le filet n'est pas de nous, et il n'est pas non plus du thème neutre.**
   * Celui-ci est plat jusqu'au bord — relevé sur leur fichier, `#F2F2F2`
   * partout — et un fond plat à 1,04 contre le parchemin de la page serait un
   * bouton qu'on ne verrait pas. Le trait est donc celui de leur thème clair,
   * `#747775`, relevé au pixel sur leur bouton : on combine deux de leurs
   * traitements au lieu d'en inventer un, et leurs règles portent sur le `G`,
   * non sur le bord du contenant. Il pèse 4,2 contre la page, assez pour
   * dessiner un objet.
   */
  google: {
    backgroundColor: "#F2F2F2",
    borderWidth: 1,
    borderColor: "#747775",
  },
  /** Le bleu de Facebook, qui est le sien et non celui de l'atlas. */
  facebook: { backgroundColor: "#1877F2" },
  /**
   * La cire de l'atlas : la seule porte qui soit à nous, et qui le dise.
   *
   * Elle fut grise, et la grisaille n'était qu'une façon de n'être pas noire
   * — la feuille d'Apple l'est, et deux portes de la même couleur à deux
   * lignes d'écart se lisaient comme une seule. Mais trois des quatre portes
   * appartiennent à d'autres et portent leurs couleurs ; celle-ci est la
   * nôtre, et la cire est ce que l'atlas emploie partout ailleurs pour ce qui
   * lui appartient.
   *
   * Elle porte le blanc à 7,6 contre 1 et se détache du parchemin à 7,1 —
   * mieux que le gris sur les deux comptes.
   */
  email: { backgroundColor: palette.wax },
  dim: { opacity: 0.7 },
  waiting: { opacity: 0.5 },
  label: { ...type.body, fontWeight: "600" },
  /** L'encre de Google sur leur fond clair, et non du blanc : 16,5 contre 1. */
  labelGoogle: { color: "#1F1F1F" },
  labelFacebook: { color: "#FFFFFF" },
  labelEmail: { color: palette.surfaceRaised },
  /**
   * Le disque blanc, désormais pour la seule arobase.
   *
   * Les deux autres portent leur fichier officiel, qui apporte son propre fond
   * — blanc pour le `G`, transparent pour le `f`. Leur poser un disque
   * dessous aurait doublé le premier et effacé le second.
   */
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  markLetter: { fontSize: 17, fontWeight: "800", lineHeight: 21 },
  /** La même boîte que le disque, pour que les trois portes gardent leur rythme. */
  markImage: { width: MARK, height: MARK },
  letterEmail: { color: palette.ink },
  pact: { ...type.caption, color: palette.inkFaint, marginTop: space.xs },
  link: { color: palette.wax, fontWeight: "600" },
});
