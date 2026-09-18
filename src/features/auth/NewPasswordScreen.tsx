import { useState } from "react";
import {
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
import { failures, isStrong, strength } from "./password";
import { InkButton, InkField } from "../../components/ui";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

/**
 * The end of a recovery: choose a password, and only that.
 *
 * Shown instead of the map, although the reader is by then signed in — the
 * link proved who they are. Letting them through to the app would leave an
 * account whose password nobody knows, least of all its owner, until the next
 * time they are signed out.
 *
 * The way out is deliberately not free: signing out abandons the recovery and
 * returns to the door, which is the honest alternative to choosing.
 */
export function NewPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { account, setPassword, signOut } = useAuth();

  const [password, setChosen] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const missing = failures(password);

  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await setPassword(password);
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.body,
          {
            paddingTop: insets.top + space.xxl,
            paddingBottom: insets.bottom + space.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Choisissez un mot de passe</Text>
          <Text style={styles.line}>
            Le lien a fait son travail : il ne reste qu'à décider du nouveau mot
            de passe de <Text style={styles.strong}>{account?.email}</Text>.
          </Text>

          <View>
            <InkField
              label="Nouveau mot de passe"
              value={password}
              onChangeText={setChosen}
              placeholder="Choisissez-en un solide"
              secureTextEntry={!shown}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={() => {
                if (isStrong(password) && !busy) void save();
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                shown ? "Masquer le mot de passe" : "Afficher le mot de passe"
              }
              hitSlop={8}
              onPress={() => setShown((was) => !was)}
              style={styles.reveal}
            >
              <Text style={styles.revealLabel}>{shown ? "Masquer" : "Afficher"}</Text>
            </Pressable>
          </View>

          <View style={styles.rules}>
            <View style={styles.gauge}>
              <View
                style={[
                  styles.gaugeFill,
                  {
                    width: `${Math.round(strength(password) * 100)}%`,
                    backgroundColor:
                      missing.length === 0 ? palette.forest : palette.wax,
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

          {problem === null ? null : <Text style={styles.problem}>{problem}</Text>}

          <InkButton
            label={busy ? "…" : "Enregistrer"}
            variant="solid"
            disabled={busy || !isStrong(password)}
            onPress={() => void save()}
          />
        </View>

        <InkButton
          label="Annuler et revenir à la connexion"
          variant="quiet"
          onPress={() => void signOut()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  body: {
    flexGrow: 1,
    justifyContent: "center",
    gap: space.lg,
    paddingHorizontal: space.xl,
  },
  card: {
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    ...shadow.soft,
  },
  title: { ...type.title, fontWeight: "700", color: palette.ink },
  line: { ...type.caption, color: palette.inkSoft },
  strong: { color: palette.ink, fontWeight: "700" },
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
});
