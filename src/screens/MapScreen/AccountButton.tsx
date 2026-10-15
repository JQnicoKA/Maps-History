import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Dialog,
  GlyphButton,
  InkButton,
  InkField,
  Sheet,
} from "../../components/ui";
import { isStrong, PasswordMeter, useAuth } from "../../features/auth";
import {
  NoticeList,
  useNotices,
} from "../../features/community/NoticeList";
import type { NoticeKind } from "../../features/community/notices";
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
/**
 * Which of the card's six faces is showing.
 *
 * Le pseudonyme a perdu la sienne le jour où la bibliothèque a cessé de
 * signer ses entrées : plus rien ne l'affiche à personne, et un champ
 * intitulé « votre nom dans la communauté » promettait alors une chose
 * fausse. Le pseudonyme existe toujours, engendré par l'application, et ne
 * sert plus qu'au conservateur pour lire sa file.
 *
 * Les notifications ont pris la place vide, et ce n'est pas un hasard : ce
 * sont les deux seules choses que la bibliothèque ait à dire à quelqu'un, et
 * cette carte était déjà le seul endroit qui lui parle de son compte.
 */
type Face =
  | "account"
  | "changing"
  | "leaving"
  | "erasing"
  | "proving";

export type AccountButtonProps = {
  /**
   * Demande la fiche d'une entrée de la bibliothèque, depuis une notification.
   *
   * L'écran baisse cette carte avant d'ouvrir le catalogue : iOS refuse de
   * présenter depuis une modale qui se retire encore. C'est `onClosed` de
   * `Dialog` qui donne le signal, et c'est pour ce genre de passage de main
   * qu'il a été ajouté.
   */
  onSeeEntry: (kind: NoticeKind, entry: string) => void;
};

export function AccountButton({ onSeeEntry }: AccountButtonProps) {
  const { account, signOut, deleteAccount, changePassword } = useAuth();
  const { notices, reload } = useNotices();
  const [open, setOpen] = useState(false);
  const [face, setFace] = useState<Face>("account");
  /** Ce qu'il faudra lever une fois cette carte partie — voir `onSeeEntry`. */
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  /**
   * Les notifications, dans une feuille à elles.
   *
   * Elles étaient une sixième face de cette carte, défilant sous un plafond
   * de la moitié de l'écran. Une carte centrée est pour une question à deux
   * réponses ; une liste qu'on parcourt, qu'on ouvre et qu'on vide est
   * exactement ce que les feuilles de cette application font, en pleine
   * hauteur et depuis le pouce.
   */
  const [reading, setReading] = useState(false);
  /** The password being proved: the current one on both asking faces. */
  const [password, setPassword] = useState("");
  /** And the one being chosen, on the face that chooses one. */
  const [chosen, setChosen] = useState("");
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
    setProblem(null);
    setDone(null);
  };

  const back = () => {
    setFace("account");
    setPassword("");
    setChosen("");
    setProblem(null);
  };

  /** Leaves the first face for one of the four that ask something. */
  const ask = (next: Face) => {
    setFace(next);
    setPassword("");
    setChosen("");
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
      <GlyphButton
        accessibilityLabel={
          notices.length === 0
            ? "Votre compte"
            : `Votre compte, ${notices.length} notification${notices.length > 1 ? "s" : ""}`
        }
        onPress={() => {
          setOpen(true);
          // Relu à l'ouverture : la carte reste montée toute la session, et
          // ce qui a changé depuis le lancement doit s'y voir.
          void reload();
        }}
      >
        <Image source={PROFILE} style={styles.glyph} resizeMode="contain" />
        {/* Le point sur le disque lui-même, et pas seulement dans la carte :
            une notification qu'il faut penser à aller chercher n'est pas une
            notification. Cire à cacheter plutôt que rouge d'alerte — elle
            signale ce qui attend un regard, pas ce qui a mal tourné. */}
        {notices.length > 0 ? <View style={styles.spot} /> : null}
      </GlyphButton>

      <Dialog
        visible={open}
        onClose={close}
        onClosed={() => {
          if (!leaving) return;
          const deed = leaving;
          setLeaving(null);
          deed();
        }}
        /* A panel, not a question: titled like the sheets it sits beside. */
        centred
        title={
          face === "changing"
            ? "Changer le mot de passe"
            : face === "leaving"
            ? "Se déconnecter ?"
            : face === "erasing"
              ? "Supprimer le compte ?"
              : face === "proving"
                ? "Votre mot de passe"
                : "Votre compte"
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
        ) : (
          <>
            {/* Trois champs, et rien d'autre : l'adresse, le mot de passe,
                les notifications. La carte montrait deux rangées serrées où la
                valeur et son action se partageaient la ligne, et tout y
                paraissait collé. Chacun a désormais son titre et sa boîte,
                comme n'importe quel champ de l'application — `InkField` en
                donne la recette, et ces trois-là s'y accordent au pixel même
                s'ils ne se saisissent pas. */}
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
                  onPress={() => {
                    // Baisser la carte, puis lever la feuille : iOS refuse de
                    // présenter depuis une modale qui se retire encore.
                    setLeaving(() => () => setReading(true));
                    close();
                  }}
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
          </>
        )}
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
              setLeaving(() => () => onSeeEntry(kind, entry));
              setReading(false);
            }}
          />
        </ScrollView>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  /**
   * Les trois champs, largement espacés.
   *
   * Vingt points entre eux plutôt que huit : le `Dialog` serre ses enfants
   * pour une pile de boutons, ce qui est juste quand on choisit et faux
   * quand on lit. Ici chaque champ est une question distincte, et l'œil doit
   * pouvoir les séparer sans les relire.
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

  /** Les deux boutons des autres faces : annuler, et confirmer. */
  answers: { flexDirection: "row", gap: space.sm },

  /** Le contenu défilant des notifications, à l'écart du bord de la carte. */
  /**
   * La gouttière des feuilles, que la feuille ne pose pas elle-même.
   *
   * Elle n'avait que du rembourrage vertical du temps où cette liste vivait
   * dans la carte du compte, qui padde ses enfants. Une feuille ne padde rien :
   * sans cela les rangées toucheraient ses deux bords.
   */
  scrolled: {
    paddingHorizontal: space.xl,
    paddingVertical: space.xs,
    paddingBottom: space.lg,
  },

  /** Détaché du reste : quitter n'est pas un champ de plus. */
  leave: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  glyph: { width: 22, height: 22 },
  /**
   * Le point sur le disque du compte.
   *
   * Bordé de la couleur du disque : posé sur le bord du cercle, sans cette
   * bordure il se confond avec le trait qui le dessine.
   */
  spot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.wax,
    borderWidth: 1.5,
    borderColor: palette.paperLight,
  },

  /** Who you are on the left, what proves it on the right. */
  /** Drawn under the words the way the card's own title is underlined. */
  down: { opacity: 0.55 },
  /** What the field says about itself while it is being typed. */

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
  done: { ...type.caption, color: palette.forest },
});
