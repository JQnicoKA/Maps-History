import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "./AuthProvider";
import { failures, isStrong, looksLikeEmail, strength } from "./password";
import { InkButton, InkField, SegmentedControl } from "../../components/ui";
import { APPLE_POSSIBLE } from "./social";
import { SocialSignIn } from "./SocialSignIn";
import { env } from "../../config/env";
import { PRIVACY_URL, TERMS_URL } from "../../config/contact";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

const LOGO = require("../../../assets/logo.png");

type Mode = "in" | "up" | "forgot";

const MODES = [
  { value: "in" as const, label: "Connexion" },
  { value: "up" as const, label: "Inscription" },
];

/**
 * The door.
 *
 * One screen for both halves, because they ask for the same two things and a
 * reader who guesses wrong should not have to go back. What changes between
 * them is what happens under the password: signing in, nothing; signing up, the
 * four rules, ticked as they are met.
 *
 * Nothing here says "invalid" before it can know. The button is out of reach
 * until the form could plausibly succeed, and the only red on the screen is the
 * answer that came back from the server.
 */
export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, sendReset } = useAuth();

  /**
   * Le formulaire est-il ouvert ?
   *
   * **Deux temps plutôt qu'un seul écran empilé.** Les quatre façons d'entrer
   * se valent, et les mettre au même niveau les fait se comparer d'un regard.
   * Déplier le formulaire sous elles donnait une page longue où trois boutons
   * courts précédaient six champs : on ne lisait plus un choix, on lisait un
   * formulaire précédé d'options.
   *
   * L'adresse est la quatrième porte, et c'est elle qui ouvre ce second temps.
   */
  const [withEmail, setWithEmail] = useState(
    /* Ouvert d'emblée quand il n'y a rien d'autre à offrir : une page qui ne
       porterait qu'une seule porte ferait cliquer pour rien. Le cas se
       présente sur un Android dont ni Google ni Facebook ne sont configurés. */
    !APPLE_POSSIBLE && !env.hasGoogleLogin && !env.hasFacebookLogin,
  );
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /**
   * The box, ticked or not.
   *
   * Unticked to begin with and required to sign up: an agreement that ticks
   * itself is not one. It is also what the App Store asks of an application
   * whose readers can see what other readers wrote — a promise, made before
   * the first line is written, that this is not the place for it.
   */
  const [agreed, setAgreed] = useState(false);
  /** Set when a sign-up, or a reset, ends with a message rather than a session. */
  const [sent, setSent] = useState(false);

  const missing = mode === "up" ? failures(password) : [];
  const ready =
    looksLikeEmail(email) &&
    (mode === "forgot"
      ? true
      : mode === "in"
        ? password !== ""
        : isStrong(password) && agreed);

  const submit = async () => {
    setBusy(true);
    setProblem(null);
    try {
      if (mode === "forgot") {
        await sendReset(email);
        setSent(true);
        return;
      }
      if (mode === "in") {
        await signIn(email, password);
        return;
      }
      // On success the provider swaps this screen out from under us; the only
      // outcome worth handling here is the one that leaves us standing.
      if ((await signUp(email, password)) === "confirm-email") setSent(true);
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const change = (next: Mode) => {
    setMode(next);
    setProblem(null);
    setSent(false);
  };

  if (sent) {
    return (
      <View style={[styles.screen, styles.middle]}>
        <View style={styles.card}>
          <Text style={styles.title}>Vérifiez votre courrier</Text>
          <Text style={styles.line}>
            {mode === "forgot"
              ? "Un lien de réinitialisation est parti vers "
              : "Un lien de confirmation est parti vers "}
            <Text style={styles.strong}>{email.trim()}</Text>
            {mode === "forgot"
              ? ". Ouvrez-le depuis ce téléphone : il rouvrira l'application sur le choix du nouveau mot de passe."
              : ". Ouvrez-le, puis revenez vous connecter."}
          </Text>
          <InkButton
            label="Revenir à la connexion"
            variant="solid"
            onPress={() => {
              setSent(false);
              setMode("in");
              setPassword("");
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Image source={LOGO} style={styles.logo} resizeMode="cover" />
          <Text style={styles.name}>HistoryNote</Text>
          <Text style={styles.motto}>L'histoire, dans la poche.</Text>
        </View>

        <View style={styles.card}>
          {/* Le premier temps : les quatre portes, et rien d'autre. */}
          {withEmail ? null : (
            <>
              <SocialSignIn
                disabled={busy}
                onBusyChange={setBusy}
                onProblem={setProblem}
                onEmail={() => {
                  setWithEmail(true);
                  setProblem(null);
                }}
              />

              {/* **Ici aussi, et c'est un défaut rattrapé.** Le message d'erreur
                  ne vivait que dans le formulaire : une connexion Apple, Google
                  ou Facebook qui échouait ne disait donc rien du tout, et le
                  lecteur restait devant quatre boutons qui semblaient inertes.
                  Un refus est silencieux — c'est voulu —, une panne ne doit
                  jamais l'être. */}
              {problem === null ? null : (
                <Text style={styles.problem}>{problem}</Text>
              )}
            </>
          )}

          {withEmail ? (
            <>
            {/* Le chemin du retour, en tête du formulaire.
                Un lien discret et non un bouton : revenir au choix n'est pas
                l'action qu'on est venu faire, et un second bouton plein se
                disputerait la place avec « Se connecter ». */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Revenir aux autres façons de se connecter"
              hitSlop={8}
              onPress={() => {
                setWithEmail(false);
                setMode("in");
                setProblem(null);
              }}
              style={styles.back}
            >
              <Text style={styles.backLabel}>‹ Autres options</Text>
            </Pressable>

            {mode === "forgot" ? (
              <Text style={styles.forgotTitle}>Mot de passe oublié</Text>
            ) : (
              <SegmentedControl
                segments={MODES}
                value={mode === "in" ? "in" : "up"}
                onChange={change}
              />
            )}

            <InkField
              label="Adresse électronique"
              value={email}
              onChangeText={setEmail}
              placeholder="vous@exemple.fr"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />

            {mode === "forgot" ? null : (
            <View>
              <InkField
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                placeholder={mode === "up" ? "Choisissez un mot de passe complexe" : "Votre mot de passe"}
                secureTextEntry={!shown}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                textContentType={mode === "up" ? "newPassword" : "password"}
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (ready && !busy) void submit();
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                hitSlop={8}
                onPress={() => setShown((was) => !was)}
                style={styles.reveal}
              >
                <Text style={styles.revealLabel}>{shown ? "Masquer" : "Afficher"}</Text>
              </Pressable>
            </View>
            )}

            {mode === "up" ? (
              <View style={styles.rules}>
                <View style={styles.gauge}>
                  <View
                    style={[
                      styles.gaugeFill,
                      {
                        width: `${Math.round(strength(password) * 100)}%`,
                        backgroundColor: missing.length === 0 ? palette.good : palette.wax,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.rulesText}>
                  {password === ""
                    ? "Il faut 8 caractères ou plus, une minuscule, une majuscule et un chiffre."
                    : missing.length === 0
                      ? "Bon mot de passe."
                      : `Il manque : ${missing.map((rule) => rule.label).join(", ")}.`}
                </Text>
              </View>
            ) : null}

            {mode === "up" ? (
              <View style={styles.pact}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: agreed }}
                  accessibilityLabel="J'accepte les conditions d'utilisation"
                  onPress={() => setAgreed((was) => !was)}
                  style={({ pressed }) => [styles.box, agreed && styles.boxOn, pressed && styles.dim]}
                >
                  {agreed ? <Text style={styles.tick}>✓</Text> : null}
                </Pressable>
                <Text style={styles.pactText}>
                  J'accepte les{" "}
                  <Text
                    style={styles.link}
                    onPress={() => void Linking.openURL(TERMS_URL)}
                  >
                    conditions d'utilisation
                  </Text>{" "}
                  et la{" "}
                  <Text
                    style={styles.link}
                    onPress={() => void Linking.openURL(PRIVACY_URL)}
                  >
                    politique de confidentialité
                  </Text>
                </Text>
              </View>
            ) : null}

            {problem === null ? null : <Text style={styles.problem}>{problem}</Text>}

            <InkButton
              label={
                busy
                  ? "…"
                  : mode === "in"
                    ? "Se connecter"
                    : mode === "up"
                      ? "Créer le compte"
                      : "Envoyer le lien"
              }
              variant="solid"
              disabled={busy || !ready}
              onPress={() => void submit()}
            />
            </>
          ) : null}
        </View>

        {/* Le pied appartient au formulaire : il n'a rien à dire devant les
            quatre portes, où il n'y a ni mot de passe à oublier ni onglet où
            passer. */}
        {!withEmail ? null : mode === "forgot" ? (
          <InkButton
            label="Revenir à la connexion"
            variant="quiet"
            onPress={() => change("in")}
          />
        ) : mode === "in" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => change("forgot")}
            hitSlop={8}
          >
            <Text style={styles.footnote}>Mot de passe oublié ?</Text>
          </Pressable>
        ) : (
          <Text style={styles.footnote}>Déjà un compte ? Passez à Connexion.</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Large enough to be the reason the screen exists. */
const LOGO_SIZE = 148;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.surface },
  middle: { alignItems: "center", justifyContent: "center", padding: space.xl },
  body: {
    flexGrow: 1,
    justifyContent: "center",
    gap: space.xxl,
    paddingHorizontal: space.xl,
  },
  brand: { alignItems: "center", gap: space.md },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    // The proportion iOS itself rounds an icon by, so the badge on this screen
    // and the one on the home screen read as the same object.
    borderRadius: LOGO_SIZE * 0.24,
    /* Sans filet depuis que le logo est sombre.
       Il en portait un parce que l'ancien badge était crème sur un écran
       crème : sans bord, il n'avait pas de contour. Celui-ci est d'un rouge
       de brique sur du papier clair — il se détache tout seul, et le filet
       pâle ne faisait plus qu'un anneau posé sur le dessin. */
  },
  name: {
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: 0.4,
    fontWeight: "700",
    color: palette.ink,
  },
  /**
   * Two readings, and both are the app: history put back in its place, and
   * every event set down at the spot on the map where it happened.
   */
  motto: {
    ...type.body,
    fontStyle: "italic",
    color: palette.inkSoft,
    textAlign: "center",
  },
  line: { ...type.caption, color: palette.inkSoft, textAlign: "center" },
  strong: { color: palette.ink, fontWeight: "700" },
  card: {
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    ...shadow.soft,
  },
  title: { ...type.title, fontWeight: "700", color: palette.ink, textAlign: "center" },
  /** Sits over the field's own label, at the right of the same line. */
  reveal: { position: "absolute", right: 0, top: 0, paddingHorizontal: space.xs },
  revealLabel: { ...type.legend, color: palette.inkFaint },
  rules: { gap: space.sm },
  gauge: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.sunken,
    overflow: "hidden",
  },
  gaugeFill: { height: "100%", borderRadius: radius.pill },
  /** The one promise made before anything is written. */
  pact: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  box: {
    width: 24,
    height: 24,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
  },
  boxOn: { backgroundColor: palette.wax, borderColor: palette.waxDeep },
  tick: { fontSize: 14, lineHeight: 16, fontWeight: "900", color: palette.surfaceRaised },
  dim: { opacity: 0.6 },
  pactText: { ...type.caption, flex: 1, color: palette.inkSoft },
  link: { color: palette.wax, fontWeight: "700", textDecorationLine: "underline" },
  rulesText: { ...type.caption, color: palette.inkSoft },
  problem: { ...type.caption, color: palette.danger },
  footnote: { ...type.caption, color: palette.inkFaint, textAlign: "center" },
  /** Le retour aux quatre portes, aligné à gauche au-dessus du formulaire. */
  back: { alignSelf: "flex-start" },
  backLabel: { ...type.caption, color: palette.inkSoft, fontWeight: "600" },
  forgotTitle: { ...type.heading, fontWeight: "700", color: palette.ink },
});
