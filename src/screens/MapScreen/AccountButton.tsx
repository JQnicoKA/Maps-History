import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import {
  Dialog,
  GlyphButton,
  InkButton,
  InkField,
  SegmentedControl,
} from "../../components/ui";
import { useAuth } from "../../features/auth";
import { deleteOwnPhotos } from "../../features/events/api";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

const PROFILE = require("../../../assets/icons/profile.png");

export type ScreenView = "map" | "list";

const VIEWS = [
  { value: "map" as const, label: "Carte", icon: require("../../../assets/icons/view-map.png") },
  { value: "list" as const, label: "Liste", icon: require("../../../assets/icons/view-list.png") },
];

export type AccountButtonProps = {
  view: ScreenView;
  onChange: (view: ScreenView) => void;
};

/**
 * The only button in the top-left corner: who you are, and how you are looking.
 *
 * The two used to be separate — a toggle that flipped between map and list, and
 * an account disc beside it. Two buttons for two rare decisions, in the corner
 * where the map is worth seeing. They are one now.
 *
 * **One dialogue, two faces, and that is not a style choice.** iOS will not
 * present a modal from a controller that is already presenting one: a
 * confirmation opened *over* this card never appeared, and pressing "Se
 * déconnecter" did nothing at all. So the card changes what it holds instead of
 * putting a second card on top of itself.
 */
/** Which of the card's three faces is showing. */
type Face = "account" | "leaving" | "erasing";

export function AccountButton({ view, onChange }: AccountButtonProps) {
  const { account, signOut, deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [face, setFace] = useState<Face>("account");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** Set by the development-only button below; read on the next render. */
  const [breaking, setBreaking] = useState(false);

  if (breaking) {
    throw new Error(
      "Erreur de vérification déclenchée depuis la carte du compte (test Sentry)",
    );
  }

  const close = () => {
    setOpen(false);
    setFace("account");
    setPassword("");
    setProblem(null);
  };

  const back = () => {
    setFace("account");
    setPassword("");
    setProblem(null);
  };

  /** Shared by both irreversible answers: they end the same way. */
  const attempt = async (deed: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      // On success there is nothing to tidy: the whole screen is replaced by
      // the sign-in one, this component included.
      await deed();
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const erase = () =>
    attempt(async () => {
      // The bucket first, while there is still a session allowed to empty it:
      // rows cascade when the account goes, files do not.
      await deleteOwnPhotos();
      await deleteAccount(password);
    });

  return (
    <>
      <GlyphButton accessibilityLabel="Votre compte" onPress={() => setOpen(true)}>
        <Image source={PROFILE} style={styles.glyph} resizeMode="contain" />
      </GlyphButton>

      <Dialog
        visible={open}
        onClose={close}
        title={
          face === "leaving"
            ? "Se déconnecter ?"
            : face === "erasing"
              ? "Supprimer le compte ?"
              : "Votre compte"
        }
        hint={
          face === "leaving"
            ? "Il faudra vous reconnecter."
            : face === "erasing"
              ? "Événements, classeurs, personnages, arbres et photos seront effacés. C'est définitif."
              : account?.email
        }
        dismissLabel={null}
      >
        {face === "leaving" ? (
          // Side by side, and the way out carries a background of its own:
          // between two answers to one question, neither should look like an
          // afterthought.
          <View style={styles.answers}>
            <InkButton
              label="Annuler"
              variant="tonal"
              grow
              disabled={busy}
              onPress={back}
            />
            <InkButton
              label={busy ? "…" : "Confirmer"}
              variant="solid"
              tone="danger"
              grow
              disabled={busy}
              onPress={() => void attempt(signOut)}
            />
          </View>
        ) : face === "erasing" ? (
          <>
            {/* The password again: this is two taps from the map, and a phone
                left on a table should not be enough to empty an account. */}
            <InkField
              label="Votre mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="done"
            />

            {problem === null ? null : (
              <Text style={styles.problem}>{problem}</Text>
            )}

            <View style={styles.answers}>
              <InkButton
                label="Annuler"
                variant="tonal"
                grow
                disabled={busy}
                onPress={back}
              />
              <InkButton
                label={busy ? "Suppression…" : "Supprimer"}
                variant="solid"
                tone="danger"
                grow
                disabled={busy || password === ""}
                onPress={() => void erase()}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.legend}>Vue</Text>
              <SegmentedControl
                segments={VIEWS}
                value={view}
                onChange={(next) => {
                  onChange(next);
                  close();
                }}
              />
            </View>

            {problem === null ? null : (
              <Text style={styles.problem}>{problem}</Text>
            )}

            <InkButton
              label="Se déconnecter"
              variant="solid"
              tone="danger"
              onPress={() => setFace("leaving")}
            />

            {/* Only in a development build, and deliberately kept rather than
                deleted after the first check: a reporting pipeline nobody can
                exercise is one nobody knows is broken. It throws during a
                render, which is the path a real bug takes — boundary, screen,
                report — and not merely a call to the reporter. */}
            {__DEV__ ? (
              <InkButton
                label="Provoquer une erreur (dev)"
                variant="quiet"
                onPress={() => setBreaking(true)}
              />
            ) : null}
            {/* Quiet, and last: it must be findable — the App Store asks for
                exactly that — without sitting under the thumb. */}
            <InkButton
              label="Supprimer le compte"
              variant="quiet"
              tone="danger"
              onPress={() => setFace("erasing")}
            />
          </>
        )}
      </Dialog>
    </>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 22, height: 22 },
  section: { gap: space.sm },
  answers: { flexDirection: "row", gap: space.sm },
  legend: { ...type.legend, color: palette.inkSoft },
  problem: { ...type.caption, color: palette.danger },
});
