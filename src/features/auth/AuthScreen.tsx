import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
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

  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** Set when a sign-up, or a reset, ends with a message rather than a session. */
  const [sent, setSent] = useState(false);

  const missing = mode === "up" ? failures(password) : [];
  const ready =
    looksLikeEmail(email) &&
    (mode === "forgot"
      ? true
      : mode === "in"
        ? password !== ""
        : isStrong(password));

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
          <Text style={styles.motto}>L'histoire, à sa place.</Text>
        </View>

        <View style={styles.card}>
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
              placeholder={mode === "up" ? "Choisissez-en un solide" : "Votre mot de passe"}
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
                      backgroundColor: missing.length === 0 ? palette.forest : palette.wax,
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
        </View>

        {mode === "forgot" ? (
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
  screen: { flex: 1, backgroundColor: palette.paper },
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
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
    backgroundColor: palette.paperLight,
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
  rulesText: { ...type.caption, color: palette.inkSoft },
  problem: { ...type.caption, color: palette.danger },
  footnote: { ...type.caption, color: palette.inkFaint, textAlign: "center" },
  forgotTitle: { ...type.heading, fontWeight: "700", color: palette.ink },
});
