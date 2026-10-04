import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import {
  Dialog,
  GlyphButton,
  InkButton,
  InkField,
} from "../../components/ui";
import { isStrong, PasswordMeter, useAuth } from "../../features/auth";
import { handleProblem, HANDLE_MAX } from "../../features/community/profile";
import { CONTACT } from "../../config/contact";
import { deleteOwnPhotos } from "../../features/events/api";
import { palette } from "../../theme/palette";
import { radius, space, TOUCH, type } from "../../theme/tokens";

const PROFILE = require("../../../assets/icons/profile.png");
const TRASH = require("../../../assets/icons/trash.png");

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
/** Which of the card's six faces is showing. */
type Face =
  | "account"
  | "naming"
  | "changing"
  | "leaving"
  | "erasing"
  | "proving";

export function AccountButton() {
  const { account, signOut, deleteAccount, changePassword, handle, rename } =
    useAuth();
  const [open, setOpen] = useState(false);
  const [face, setFace] = useState<Face>("account");
  /** The password being proved: the current one on both asking faces. */
  const [password, setPassword] = useState("");
  /** And the one being chosen, on the face that chooses one. */
  const [chosen, setChosen] = useState("");
  /** The pseudonym being typed, on the face that renames. */
  const [called, setCalled] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** What just worked, said once on the first face and then forgotten. */
  const [done, setDone] = useState<string | null>(null);
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
    setChosen("");
    setCalled("");
    setProblem(null);
    setDone(null);
  };

  const back = () => {
    setFace("account");
    setPassword("");
    setChosen("");
    setCalled("");
    setProblem(null);
  };

  /** Leaves the first face for one of the four that ask something. */
  const ask = (next: Face) => {
    setFace(next);
    setPassword("");
    setChosen("");
    setCalled("");
    setProblem(null);
    setDone(null);
  };

  /**
   * Shared by the three answers that talk to the server: they all end the
   * same way — busy while it runs, the reason in red if it refuses.
   *
   * What follows a success is the deed's own business. Two of them have
   * nothing to tidy, the whole screen being replaced by the sign-in one, this
   * component included; the third comes back to the first face.
   */
  const attempt = async (deed: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await deed();
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  /** Both fields answered, and the new one worth having. */
  const ready = password !== "" && isStrong(chosen);

  /** What is wrong with the pseudonym being typed, while it is being typed. */
  const naming = handleProblem(called);

  const callMe = () =>
    attempt(async () => {
      await rename(called);
      setFace("account");
      setCalled("");
      setDone("Pseudonyme modifié.");
    });

  const change = () =>
    attempt(async () => {
      await changePassword(password, chosen);
      // Back to the first face rather than off the screen: the reader asked
      // for one thing, and a card that vanishes leaves them wondering whether
      // it took.
      setFace("account");
      setPassword("");
      setChosen("");
      setDone("Mot de passe modifié.");
    });

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
          face === "changing"
            ? "Changer le mot de passe"
            : face === "leaving"
            ? "Se déconnecter ?"
            : face === "naming"
              ? "Votre pseudonyme"
              : face === "erasing"
                ? "Supprimer le compte ?"
                : face === "proving"
                  ? "Votre mot de passe"
                  : "Votre compte"
        }
        hint={
          face === "leaving"
            ? "Il faudra vous reconnecter."
            : face === "naming"
              ? "C'est le nom qui accompagne ce que vous partagez. Il ne dit rien de votre adresse."
              : face === "erasing"
                ? "Événements, classeurs, personnages, arbres et photos seront effacés. C'est définitif."
                : face === "proving"
                  ? "Dernière étape : tapez-le pour confirmer la suppression."
                  : undefined
        }
        dismissLabel={null}
      >
        {face === "naming" ? (
          <>
            <InkField
              label="Pseudonyme"
              value={called}
              onChangeText={setCalled}
              placeholder={handle ?? "Cartographe-1487"}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={HANDLE_MAX}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                if (naming === null && !busy) void callMe();
              }}
            />

            {/* The rule, said while it is being broken rather than after. */}
            <Text style={styles.rule}>
              {called === ""
                ? "Lettres, chiffres, espaces, tirets et apostrophes."
                : (naming ?? "Ce pseudonyme convient.")}
            </Text>

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
                label={busy ? "…" : "Enregistrer"}
                variant="solid"
                grow
                disabled={busy || naming !== null}
                onPress={() => void callMe()}
              />
            </View>
          </>
        ) : face === "changing" ? (
          <>
            {/* Proof before choice, in that order: it is the question the
                reader can answer straight away, and the one that decides
                whether the rest is worth typing. */}
            <InkField
              label="Mot de passe actuel"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="next"
            />

            <InkField
              label="Nouveau mot de passe"
              value={chosen}
              onChangeText={setChosen}
              placeholder="Choisissez un mot de passe complexe"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (ready && !busy) void change();
              }}
            />

            {/* The same bar and the same sentence as the recovery screen. */}
            <PasswordMeter password={chosen} />

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
                label={busy ? "…" : "Enregistrer"}
                variant="solid"
                grow
                disabled={busy || !ready}
                onPress={() => void change()}
              />
            </View>
          </>
        ) : face === "leaving" ? (
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
          // Asked before anything is typed. The question and the proof used to
          // be one card, which put a password field under a reader who had not
          // yet said they wanted this — and made the field look like the
          // question rather than the confirmation of an answer already given.
          <View style={styles.answers}>
            <InkButton
              label="Annuler"
              variant="tonal"
              grow
              disabled={busy}
              onPress={back}
            />
            <InkButton
              label="Supprimer"
              variant="solid"
              tone="danger"
              grow
              disabled={busy}
              onPress={() => ask("proving")}
            />
          </View>
        ) : face === "proving" ? (
          <>
            {/* The password, once the reader has said yes: this is three taps
                from the map, and a phone left on a table should not be enough
                to empty an account. */}
            <InkField
              label="Votre mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (password !== "" && !busy) void erase();
              }}
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
            {/* The address, and beside it the one thing about the account
                that can be changed. A line rather than a button: this is not
                an errand anybody opens the card to run, it is a thing that
                should be *there* on the day it is wanted.

                It says "mot de passe" and not "modifier" on purpose — set
                next to an email address, "modifier" reads as an offer to
                change the address. */}
            <View style={styles.identity}>
              <Text style={styles.email} numberOfLines={1}>
                {account?.email}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Changer le mot de passe"
                hitSlop={10}
                onPress={() => ask("changing")}
                style={({ pressed }) => [styles.link, pressed && styles.down]}
              >
                <Text style={styles.linkLabel}>Mot de passe ›</Text>
                <View style={styles.linkRule} />
              </Pressable>
            </View>

            {/* The other half of who you are here. The address is between
                you and the app; this is what everybody else sees, and the
                two belong on facing lines rather than in separate corners. */}
            <View style={styles.identity}>
              <View style={styles.named}>
                <Text style={styles.handle} numberOfLines={1}>
                  {handle ?? "…"}
                </Text>
                <Text style={styles.namedLegend}>
                  Votre nom dans la communauté
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Changer de pseudonyme"
                hitSlop={10}
                disabled={handle === undefined}
                onPress={() => {
                  ask("naming");
                  setCalled(handle ?? "");
                }}
                style={({ pressed }) => [styles.link, pressed && styles.down]}
              >
                <Text style={styles.linkLabel}>Renommer ›</Text>
                <View style={styles.linkRule} />
              </Pressable>
            </View>

            {done === null ? null : <Text style={styles.done}>{done}</Text>}

            {problem === null ? null : (
              <Text style={styles.problem}>{problem}</Text>
            )}

            {/* The way out, and the way out for good, on one line. The bin is
                small and quiet on purpose: deleting an account must be
                findable — the App Store asks for exactly that — without
                sitting under the thumb of someone reaching to sign out. */}
            <View style={styles.answers}>
              <InkButton
                label="Se déconnecter"
                variant="solid"
                tone="danger"
                grow
                onPress={() => ask("leaving")}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Supprimer le compte"
                onPress={() => ask("erasing")}
                style={({ pressed }) => [styles.bin, pressed && styles.down]}
              >
                <Image source={TRASH} style={styles.binGlyph} resizeMode="contain" />
              </Pressable>
            </View>

            {/* Published, and findable without having to report something
                first: an app carrying what its readers write owes them a way
                to reach whoever keeps it. */}
            <Text style={styles.contact}>
              Un problème, une réclamation ? {CONTACT}
            </Text>

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
          </>
        )}
      </Dialog>
    </>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 22, height: 22 },

  /** Who you are on the left, what proves it on the right. */
  identity: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.md,
    marginTop: space.xs,
  },
  email: { ...type.caption, flex: 1, color: palette.inkSoft },
  link: { alignItems: "flex-end" },
  linkLabel: { ...type.caption, fontWeight: "600", color: palette.wax },
  /** Drawn under the words the way the card's own title is underlined. */
  linkRule: {
    height: 2,
    width: "100%",
    marginTop: 2,
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
    opacity: 0.45,
  },
  down: { opacity: 0.55 },
  named: { flex: 1, gap: 1 },
  handle: { fontSize: 15, fontWeight: "700", color: palette.ink },
  namedLegend: { ...type.legend, color: palette.inkFaint },
  /** What the field says about itself while it is being typed. */
  rule: { ...type.legend, color: palette.inkSoft },
  contact: { ...type.legend, color: palette.inkFaint, textAlign: "center" },

  /** Square, so it takes only the width the sign-out button gives up. */
  bin: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: palette.sunken,
  },
  binGlyph: { width: 19, height: 19, tintColor: palette.danger },

  answers: { flexDirection: "row", gap: space.sm },
  problem: { ...type.caption, color: palette.danger },
  done: { ...type.caption, color: palette.forest },
});
