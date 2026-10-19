import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Dialog,
  InkButton,
  InkField,
  Sheet,
} from "../../components/ui";
import { isStrong, PasswordMeter, useAuth } from "../../features/auth";
import { NoticeList, useNotices } from "../../features/community/NoticeList";
import type { NoticeKind } from "../../features/community/notices";
import { deleteOwnPhotos } from "../../features/events/api";
import { palette } from "../../theme/palette";
import { radius, shadow, space, TOUCH, type } from "../../theme/tokens";

const TRASH = require("../../../assets/icons/trash.png");

/**
 * Ce que la page demande, quand elle demande quelque chose.
 *
 * `null` est la page elle-même. Les quatre autres sont des **questions**, et
 * elles se posent dans une carte par-dessus : changer un mot de passe,
 * partir, effacer, le prouver.
 *
 * Elles étaient cinq faces d'une seule carte, la première comprise, parce
 * qu'iOS refuse de présenter une modale depuis une modale et qu'il fallait
 * bien les tenir ensemble. La première est devenue une page — une vue, pas
 * une modale — donc les quatre autres peuvent redevenir ce qu'elles sont.
 */
type Ask = "changing" | "leaving" | "erasing" | "proving" | null;

export type AccountScreenProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * Demande la fiche d'une entrée de la bibliothèque, depuis une notification.
   *
   * La feuille des notifications se baisse d'abord : elle, c'est une modale,
   * et le catalogue en est une autre.
   */
  onSeeEntry: (kind: NoticeKind, entry: string) => void;
};

/**
 * Votre compte, en pleine page.
 *
 * Elle fut une carte au milieu de l'écran, coiffée comme une feuille parce
 * qu'elle n'était pas une question : on l'ouvre pour lire ce qu'on est et
 * ajuster deux ou trois choses. C'est la définition d'une page, et une carte
 * centrée l'obligeait à empiler cinq faces dans un seul panneau.
 *
 * Posée au-dessus de tout, barre d'onglets comprise, comme l'arbre dessiné :
 * ce n'est pas une destination de la navigation mais un détour, et elle porte
 * sa propre sortie.
 */
export function AccountScreen({
  visible,
  onClose,
  onSeeEntry,
}: AccountScreenProps) {
  const insets = useSafeAreaInsets();
  const { account, signOut, deleteAccount, changePassword } = useAuth();
  const { notices, reload } = useNotices();
  const [face, setFace] = useState<Ask>(null);
  /** Ce qu'il faudra lever une fois la feuille des notifications partie. */
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const [reading, setReading] = useState(false);
  /** The password being proved: the current one on both asking faces. */
  const [password, setPassword] = useState("");
  /** And the one being chosen, on the face that chooses one. */
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** What just worked, said once on the page and then forgotten. */
  const [done, setDone] = useState<string | null>(null);
  /** Set by the development-only button below; read on the next render. */
  const [breaking, setBreaking] = useState(false);

  if (breaking) {
    throw new Error(
      "Erreur de vérification déclenchée depuis la page du compte (test Sentry)",
    );
  }

  if (!visible) return null;

  const close = () => {
    setFace(null);
    setPassword("");
    setChosen("");
    setProblem(null);
    setDone(null);
    onClose();
  };

  /** Revient à la page depuis l'une des quatre questions. */
  const back = () => {
    setFace(null);
    setPassword("");
    setChosen("");
    setProblem(null);
  };

  /** Quitte la page pour l'une des quatre questions. */
  const ask = (next: Ask) => {
    setFace(next);
    setPassword("");
    setChosen("");
    setProblem(null);
    setDone(null);
  };

  /**
   * Shared by the three answers that talk to the server: they all end the
   * same way — busy while it runs, the reason in red if it refuses.
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

  const change = () =>
    attempt(async () => {
      await changePassword(password, chosen);
      // Retour à la page plutôt qu'à rien : le lecteur a demandé une chose,
      // et une carte qui s'évanouit le laisse se demander si ça a pris.
      setFace(null);
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
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.title}>Votre compte</Text>
        {/* Posé en absolu : le titre reste centré sur la page et non sur ce
            que la sortie lui laisse. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          hitSlop={10}
          onPress={close}
          style={({ pressed }) => [
            styles.back,
            { top: insets.top + space.sm },
            pressed && styles.down,
          ]}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + space.xxl },
        ]}
      >
          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Adresse Mail</Text>
              <View style={styles.box}>
                <Text style={styles.value} numberOfLines={1}>
                  {account?.email}
                </Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Mot de passe</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Changer le mot de passe"
                onPress={() => ask("changing")}
                style={({ pressed }) => [styles.box, pressed && styles.down]}
              >
                {/* Des points plutôt qu'un vide : la boîte doit se lire
                    comme les deux autres, et un mot de passe a une valeur
                    même quand on ne la montre pas. */}
                <Text style={styles.value}>••••••••</Text>
                <Text style={styles.action}>Changer ›</Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Mes notifications</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voir mes notifications"
                /* Ouverte d'emblée. Elle attendait que la carte du compte
                   soit partie — iOS refuse de présenter depuis une modale
                   qui se retire encore — et cette page n'en est pas une :
                   la feuille monte par-dessus elle sans rien à baisser. */
                onPress={() => setReading(true)}
                style={({ pressed }) => [styles.box, pressed && styles.down]}
              >
                {notices.length > 0 ? <View style={styles.dot} /> : null}
                <Text style={styles.value}>
                  {notices.length === 0
                    ? "Rien de neuf"
                    : `${notices.length} à lire`}
                </Text>
                <Text style={styles.action}>Voir ›</Text>
              </Pressable>
            </View>
          </View>

          {done === null ? null : <Text style={styles.done}>{done}</Text>}

          {problem === null ? null : (
            <Text style={styles.problem}>{problem}</Text>
          )}

          {/* Tout en bas, et détaché : quitter n'est pas un réglage de
              plus. La corbeille reste petite et discrète — supprimer son
              compte doit se trouver, l'App Store l'exige, sans tomber sous
              le pouce de qui visait la déconnexion. */}
          <View style={styles.leave}>
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
      </ScrollView>

      {/* Les quatre questions, dans une carte par-dessus la page. */}
      <Dialog
        visible={face !== null}
        onClose={back}
        centred
        title={
          face === "changing"
            ? "Changer le mot de passe"
            : face === "leaving"
              ? "Se déconnecter ?"
              : face === "erasing"
                ? "Supprimer le compte ?"
                : "Votre mot de passe"
        }
        hint={
          face === "leaving"
            ? "Il faudra vous reconnecter."
            : face === "erasing"
              ? "Événements, personnages, arbres et photos seront effacés. C'est définitif."
              : face === "proving"
                ? "Dernière étape : tapez-le pour confirmer la suppression."
                : undefined
        }
        dismissLabel={null}
      >
      {face === "changing" ? (
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
        ) : null}
      </Dialog>

      {/* Pleine hauteur : la liste va d'une ligne à vingt, et un panneau qui
          se redimensionnerait autour d'elle ne tiendrait jamais en place. */}
      <Sheet
        visible={reading}
        onClose={() => setReading(false)}
        onClosed={() => {
          if (!leaving) return;
          const deed = leaving;
          setLeaving(null);
          deed();
        }}
        title="Mes notifications"
        tall
        footer={
          <InkButton
            label="Fermer"
            variant="tonal"
            grow
            onPress={() => setReading(false)}
          />
        }
      >
        <ScrollView contentContainerStyle={styles.scrolled}>
          <NoticeList
            notices={notices}
            onChanged={() => void reload()}
            // Baisser cette feuille, puis ouvrir le catalogue : `onClosed`
            // ci-dessus s'en charge une fois qu'elle est partie.
            onSee={(kind, entry) => {
              setLeaving(() => () => {
                close();
                onSeeEntry(kind, entry);
              });
              setReading(false);
            }}
          />
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Opaque et posée sur tout : c'est une page, pas un panneau.
   *
   * En absolu plutôt qu'en enfant de la colonne, parce qu'elle doit couvrir
   * la barre d'onglets. Elle n'est pas une destination de la navigation — on
   * y fait un détour, et on en revient par sa propre sortie.
   */
  page: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.surface,
  },
  /** Le même bandeau fixe que les trois pages de collection. */
  header: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: palette.surfaceRaised,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
    zIndex: 1,
    ...shadow.soft,
  },
  title: { ...type.plate, color: palette.ink, textAlign: "center" },
  back: { position: "absolute", left: space.sm, padding: space.xs },
  backGlyph: { fontSize: 30, lineHeight: 34, color: palette.inkSoft },
  down: { opacity: 0.55 },
  body: { paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.lg },

  /**
   * Les trois champs, largement espacés.
   *
   * Vingt points entre eux plutôt que huit : chaque champ est une question
   * distincte, et l'œil doit pouvoir les séparer sans les relire.
   */
  fields: { gap: space.xl, marginTop: space.xs },
  /** L'intérieur d'un champ : l'écart d'`InkField`, au point près. */
  field: { gap: space.sm },
  fieldLabel: { ...type.legend, color: palette.inkSoft },
  /** La boîte d'`InkField`, à ceci près qu'on n'y tape pas. */
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH,
    backgroundColor: palette.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  value: { flex: 1, fontSize: 16, color: palette.ink },
  /** Dans la boîte, devant le compte : on le voit avant de l'avoir lu. */
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.wax,
    marginRight: -space.xs,
  },
  action: { ...type.caption, fontWeight: "600", color: palette.wax },

  /** Les deux boutons d'une question : annuler, et confirmer. */
  answers: { flexDirection: "row", gap: space.sm },

  /** La gouttière des feuilles, que la feuille ne pose pas elle-même. */
  scrolled: {
    paddingHorizontal: space.xl,
    paddingVertical: space.xs,
    paddingBottom: space.lg,
  },

  /** Détaché du reste : quitter n'est pas un champ de plus. */
  leave: { flexDirection: "row", gap: space.sm, marginTop: space.lg },

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

  problem: { ...type.caption, color: palette.danger },
  done: { ...type.caption, color: palette.good },
});
