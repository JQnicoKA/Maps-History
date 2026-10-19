import { useState, type ReactNode } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ConfirmDialog,
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
 * Ce que l'écran montre, et il n'y a jamais qu'une chose à la fois.
 *
 * `null` est le compte lui-même, et c'est presque toujours lui. La seule
 * sous-page restante est la preuve qu'on donne avant d'effacer son compte :
 * elle mérite l'écran entier parce qu'elle est un départ et non un réglage.
 *
 * **Changer son mot de passe n'en est pas une.** C'est un réglage, et un
 * réglage se règle sur place : les deux champs se déplient sous la rangée
 * qui les annonce, dans la même carte. Envoyer le lecteur sur un autre écran
 * pour deux champs lui faisait perdre de vue ce qu'il était en train de
 * faire.
 *
 * **Les questions n'y figurent pas non plus.** « Se déconnecter ? » et
 * « Supprimer le compte ? » sont des oui/non, et un oui/non est une carte au
 * milieu de l'écran — c'est exactement ce que `ConfirmDialog` est.
 */
type Face = "proving" | null;

export type AccountScreenProps = {
  visible: boolean;
  onClose: () => void;
  /** Demande la fiche d'une entrée de la bibliothèque, depuis une notification. */
  onSeeEntry: (kind: NoticeKind, entry: string) => void;
};

/**
 * Votre compte, en pleine page.
 *
 * Trois choses y vivent et une seule est un réglage : l'adresse se lit, le
 * mot de passe se change, les notifications se parcourent. Elles sont donc
 * rangées comme on range des réglages — des rangées dans des cartes, sous
 * des surtitres — plutôt qu'en trois champs de formulaire, qui promettaient
 * une saisie qu'aucun des trois n'accepte.
 *
 * Quitter et effacer sont au pied, détachés et **fixes** : ce ne sont pas
 * des réglages de plus, et ils ne doivent pas se chercher au bas d'un
 * défilement.
 */
export function AccountScreen({
  visible,
  onClose,
  onSeeEntry,
}: AccountScreenProps) {
  const insets = useSafeAreaInsets();
  const { account, signOut, deleteAccount, changePassword } = useAuth();
  const { notices, reload } = useNotices();
  const [face, setFace] = useState<Face>(null);
  /** Les deux champs du mot de passe, dépliés sous leur rangée. */
  const [changing, setChanging] = useState(false);
  /** La question posée, s'il y en a une : se déconnecter, ou effacer. */
  const [asking, setAsking] = useState<"leaving" | "erasing" | null>(null);
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

  const clear = () => {
    setPassword("");
    setChosen("");
    setProblem(null);
  };

  const close = () => {
    setFace(null);
    setChanging(false);
    setAsking(null);
    clear();
    setDone(null);
    onClose();
  };

  /** Revient au compte depuis la sous-page. */
  const back = () => {
    setFace(null);
    clear();
  };

  /** Déplie les deux champs, ou les replie en oubliant ce qui y était. */
  const toggleChanging = () => {
    setChanging((was) => !was);
    clear();
    setDone(null);
  };

  const go = (next: Face) => {
    setFace(next);
    clear();
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
      // Replié, et la phrase le dit : le lecteur a demandé une chose, et des
      // champs qui se vident sans un mot le laissent se demander si ça a pris.
      setChanging(false);
      clear();
      setDone("Mot de passe modifié.");
    });

  const erase = () =>
    attempt(async () => {
      // The bucket first, while there is still a session allowed to empty it:
      // rows cascade when the account goes, files do not.
      await deleteOwnPhotos();
      await deleteAccount(password);
    });

  const title =
    face === "proving" ? "Confirmer la suppression" : "Votre compte";

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {/* Posé en absolu : le titre reste centré sur la page et non sur ce
            que la sortie lui laisse. Il revient d'une sous-page avant de
            fermer la page — une sortie, un cran. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={face === null ? "Fermer" : "Retour"}
          hitSlop={10}
          disabled={busy}
          onPress={face === null ? close : back}
          style={({ pressed }) => [
            styles.back,
            { top: insets.top + space.sm },
            pressed && styles.down,
          ]}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
      </View>

      {face === null ? (
        <>
          <ScrollView
            style={styles.fill}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            /* C'est la liste qui fait de la place au clavier, pas la page.
               Le pied reste donc où il est — il passe simplement derrière
               les touches, ce qui est juste : on ne se déconnecte pas en
               tapant un mot de passe. iOS seulement ; sur Android c'est la
               fenêtre qui se redimensionne, et la liste suit d'elle-même. */
            automaticallyAdjustKeyboardInsets
          >
            {done === null ? null : (
              <View style={[styles.note, styles.noteGood]}>
                <Text style={styles.noteGoodText}>{done}</Text>
              </View>
            )}

            <Group legend="Identité">
              <Row label="Adresse">
                <Text style={styles.value} numberOfLines={1}>
                  {account?.email}
                </Text>
              </Row>
              <Row
                label="Mot de passe"
                onPress={toggleChanging}
                open={changing}
                accessibilityLabel={
                  changing
                    ? "Replier le changement de mot de passe"
                    : "Changer le mot de passe"
                }
              >
                {/* Des points plutôt qu'un vide : un mot de passe a une
                    valeur même quand on ne la montre pas. */}
                <Text style={styles.value}>••••••••</Text>
              </Row>

              {/* Déplié dans la carte, sous la rangée qui l'annonce : c'est
                  cette rangée-là qu'on règle, et la voir juste au-dessus des
                  champs dit laquelle sans qu'un titre ait à le redire. */}
              {changing ? (
                <View style={styles.unfolded}>

                  {/* Proof before choice, in that order: it is the question
                      the reader can answer straight away, and the one that
                      decides whether the rest is worth typing. */}
                  <InkField
                    style={styles.onDrawer}
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
                    style={styles.onDrawer}
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

                  {/* The same bar and the same sentence as the recovery
                      screen. */}
                  <PasswordMeter
                    password={chosen}
                    track={palette.surfaceRaised}
                  />

                  {problem === null ? null : (
                    <View style={[styles.note, styles.noteBad]}>
                      <Text style={styles.noteBadText}>{problem}</Text>
                    </View>
                  )}

                  <View style={styles.answers}>
                    <InkButton
                      label="Annuler"
                      variant="tonal"
                      grow
                      disabled={busy}
                      onPress={toggleChanging}
                    />
                    <InkButton
                      label={busy ? "Enregistrement…" : "Enregistrer"}
                      variant="solid"
                      grow
                      disabled={busy || !ready}
                      onPress={() => void change()}
                    />
                  </View>
                </View>
              ) : null}
            </Group>

            <Group legend="La communauté">
              <Row
                label="Mes notifications"
                onPress={() => setReading(true)}
                accessibilityLabel="Voir mes notifications"
              >
                {notices.length > 0 ? <View style={styles.dot} /> : null}
                <Text
                  style={[styles.value, notices.length > 0 && styles.waiting]}
                >
                  {notices.length === 0
                    ? "Rien de neuf"
                    : `${notices.length} à lire`}
                </Text>
              </Row>
            </Group>

            {/* Only in a development build, and deliberately kept rather than
                deleted after the first check: a reporting pipeline nobody can
                exercise is one nobody knows is broken. It throws during a
                render, which is the path a real bug takes. */}
            {__DEV__ ? (
              <InkButton
                label="Provoquer une erreur (dev)"
                variant="quiet"
                onPress={() => setBreaking(true)}
              />
            ) : null}
          </ScrollView>

          {/* Au pied et **fixe**, hors du défilement : quitter n'est pas un
              réglage de plus, et ce qui ferme un compte ne doit pas se
              chercher au bas d'une liste. Rien ne le pousse non plus — cette
              page n'a aucun champ, donc aucun clavier ne monte ; et il est
              posé en absolu, que le système redimensionne la fenêtre ou
              recouvre l'écran.

              La corbeille reste petite et discrète : supprimer son compte
              doit se trouver, l'App Store l'exige, sans tomber sous le pouce
              de qui visait la déconnexion. */}
          <View
            style={[styles.foot, { paddingBottom: insets.bottom + space.md }]}
          >
            <InkButton
              label="Se déconnecter"
              variant="solid"
              tone="danger"
              grow
              onPress={() => setAsking("leaving")}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Supprimer le compte"
              onPress={() => setAsking("erasing")}
              style={({ pressed }) => [styles.bin, pressed && styles.down]}
            >
              <Image
                source={TRASH}
                style={styles.binGlyph}
                resizeMode="contain"
              />
            </Pressable>
          </View>
        </>
      ) : (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + space.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.lead}>
            Événements, personnages, arbres et photos seront effacés.
            C&apos;est définitif. Tapez votre mot de passe pour confirmer.
          </Text>

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
            <View style={[styles.note, styles.noteBad]}>
              <Text style={styles.noteBadText}>{problem}</Text>
            </View>
          )}

          <InkButton
            label={busy ? "Suppression…" : "Supprimer le compte"}
            variant="solid"
            tone="danger"
            disabled={busy || password === ""}
            onPress={() => void erase()}
          />
        </ScrollView>
      )}

      <ConfirmDialog
        visible={asking === "leaving"}
        title="Se déconnecter ?"
        message="Il faudra vous reconnecter."
        confirmLabel="Se déconnecter"
        cancelLabel="Annuler"
        onConfirm={() => {
          setAsking(null);
          void attempt(signOut);
        }}
        onClose={() => setAsking(null)}
      />

      <ConfirmDialog
        visible={asking === "erasing"}
        title="Supprimer le compte ?"
        /* La question avant la preuve. Les deux tenaient dans une seule
           carte, ce qui posait un champ de mot de passe sous un lecteur qui
           n'avait pas encore dit qu'il le voulait — et faisait lire le champ
           comme la question plutôt que comme la confirmation d'une réponse
           déjà donnée. */
        message="Tout ce que vous avez écrit sera effacé. On vous demandera votre mot de passe à l'étape suivante."
        confirmLabel="Continuer"
        cancelLabel="Annuler"
        onConfirm={() => {
          setAsking(null);
          setChanging(false);
          go("proving");
        }}
        onClose={() => setAsking(null)}
      />

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

/**
 * Un groupe de rangées sous son surtitre.
 *
 * La carte porte le filet entre ses rangées, et non chaque rangée : un trait
 * sous la dernière fermerait la carte deux fois, puisque son propre bord le
 * fait déjà.
 */
function Group({
  legend,
  children,
}: {
  legend: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.legend}>{legend}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/**
 * Une rangée de réglage : son nom à gauche, sa valeur à droite.
 *
 * Le chevron n'apparaît qu'avec un geste. Une rangée qui n'ouvre rien et qui
 * en porterait un promettrait une page qui n'existe pas — c'est le cas de
 * l'adresse, qu'on ne change pas ici.
 */
function Row({
  label,
  onPress,
  open = false,
  accessibilityLabel,
  children,
}: {
  label: string;
  onPress?: () => void;
  /** Ce qu'elle ouvre est déplié juste dessous : le chevron pivote. */
  open?: boolean;
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  const body = (
    <>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>{children}</View>
      {onPress === undefined ? null : (
        /* Un quart de tour vers le bas quand c'est ouvert : le même chevron
           dit « ça mène ailleurs » et « c'est là, dessous ». */
        <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
      )}
    </>
  );

  if (onPress === undefined) {
    return <View style={styles.row}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowDown]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * Opaque et posée sur tout : c'est une page, pas un panneau.
   *
   * En absolu plutôt qu'en enfant de la colonne, parce qu'elle doit couvrir
   * la barre d'onglets. On y fait un détour, et on en revient par sa propre
   * sortie.
   */
  page: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.surface,
  },
  fill: { flex: 1 },
  /** Le même bandeau fixe que les trois pages de collection. */
  header: {
    paddingHorizontal: space.xxl,
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

  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.xl,
    gap: space.xl,
  },
  /** Une phrase d'ouverture, en tête d'une sous-page. */
  lead: { ...type.body, color: palette.inkSoft },

  group: { gap: space.sm },
  legend: { ...type.legend, color: palette.inkFaint, paddingLeft: space.xs },
  card: {
    backgroundColor: palette.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    overflow: "hidden",
    ...shadow.soft,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 54,
    paddingHorizontal: space.lg,
    /**
     * Le filet entre deux rangées, posé **en haut** de chacune.
     *
     * En haut et non en bas, avec la première exemptée par le découpage de
     * la carte : un filet sous la dernière doublerait le bord de la carte.
     */
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    marginTop: -StyleSheet.hairlineWidth,
  },
  rowDown: { backgroundColor: palette.sunken },
  rowLabel: { ...type.body, color: palette.ink },
  /** La valeur pousse le chevron au bord et se serre si elle est longue. */
  rowValue: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.sm,
  },
  value: { fontSize: 15, color: palette.inkSoft, flexShrink: 1 },
  /** Ce qui attend un regard se lit en cire, comme partout ailleurs. */
  waiting: { color: palette.wax, fontWeight: "600" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.wax },
  chevron: { fontSize: 20, lineHeight: 22, color: palette.inkFaint },
  chevronOpen: { transform: [{ rotate: "90deg" }], color: palette.wax },

  /**
   * Le formulaire déplié, dans la carte et sous sa rangée.
   *
   * Il porte le fond creusé plutôt que le blanc de la carte : c'est ce qui
   * le fait lire comme un tiroir ouvert dans la rangée, et non comme une
   * seconde carte posée dessus. Le filet du haut est celui qui sépare deux
   * rangées — il en est une, à sa façon.
   */
  unfolded: {
    gap: space.lg,
    padding: space.lg,
    backgroundColor: palette.sunken,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
  /**
   * Un champ posé **dans** le tiroir, et non sur une page.
   *
   * `InkField` se creuse dans son fond : il porte `sunken` parce qu'un champ
   * est un creux dans une surface claire. Le tiroir porte ce même `sunken` —
   * c'est ce qui le fait lire comme ouvert dans la rangée — et les deux se
   * confondaient donc exactement. La règle s'inverse ici : sur un fond déjà
   * creusé, c'est le blanc qui creuse.
   *
   * Le filet rend au champ le bord que la couleur ne dessine plus : blanc
   * sur `sunken` ne vaut que 1,24, assez pour qu'on le voie, trop peu pour
   * qu'on en lise les angles.
   */
  onDrawer: {
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  /** Les deux réponses d'un formulaire : renoncer, et enregistrer. */
  answers: { flexDirection: "row", gap: space.sm },

  /** Un avis posé dans le flux : ce qui a abouti, ou ce qui a été refusé. */
  note: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteGood: { backgroundColor: "#EEF4EE", borderColor: "#CFE0D2" },
  noteGoodText: { ...type.caption, color: palette.good },
  noteBad: { backgroundColor: palette.dangerWash, borderColor: "#E8C9BD" },
  noteBadText: { ...type.caption, color: palette.danger },

  /**
   * Le pied fixe. Il porte un filet et le fond de la page, pour que le
   * défilement passe dessous sans se confondre avec lui.
   */
  foot: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    backgroundColor: palette.surface,
  },
  /** Square, so it takes only the width the sign-out button gives up. */
  bin: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  binGlyph: { width: 19, height: 19, tintColor: palette.danger },

  /** La gouttière des feuilles, que la feuille ne pose pas elle-même. */
  scrolled: {
    paddingHorizontal: space.xl,
    paddingVertical: space.xs,
    paddingBottom: space.lg,
  },
});
