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
import { NoticeList } from "../../features/community/NoticeList";
import type { Notice } from "../../features/community/notices";
import type { NoticeKind } from "../../features/community/notices";
import { deleteOwnPhotos } from "../../features/events/api";
import { ANSWER_SAID } from "../../config/contact";
import { writeToUs } from "./writeToUs";
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
type Face = "proving" | "contact" | null;

/**
 * Les deux bornes d'un message, **les mêmes que celles de la table**.
 *
 * `contact_messages` porte une contrainte `between 10 and 4000`, et c'est elle
 * qui décide : la base est le seul endroit qu'on ne peut pas contourner. Les
 * répéter ici ne sert qu'à ne pas laisser presser un bouton qui se fera
 * refuser — si les deux divergent un jour, c'est l'écran qui a tort.
 */
const SHORTEST = 10;
const LONGEST = 4000;

/**
 * Le triangle d'alerte, pour la seule page de l'application qui efface tout.
 *
 * Un dessin et non un mot de plus : la page en a déjà trois lignes, et une
 * quatrième phrase pour dire qu'elles sont graves se serait lue avec les
 * autres. Un panneau se voit avant d'être lu, ce qui est exactement ce qu'on
 * veut de quelqu'un qui arrive ici par inadvertance.
 */
const ALERT = require("../../../assets/alerte.png");

export type AccountScreenProps = {
  /** Lues par la coquille, pour que l'application n'en tienne qu'un compte. */
  notices: Notice[];
  /** À appeler quand on en efface une : la porte du bandeau doit suivre. */
  onNoticesChanged: () => void;
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
  notices,
  onNoticesChanged,
  visible,
  onClose,
  onSeeEntry,
}: AccountScreenProps) {
  const insets = useSafeAreaInsets();
  const { account, signOut, deleteAccount, changePassword, setPassword: choosePassword } =
    useAuth();
  /**
   * Ce compte a-t-il un mot de passe ?
   *
   * Non pour qui est entré par Apple, Google ou Facebook sans jamais en
   * choisir un. Deux choses en dépendent sur cette page : on ne propose pas
   * de **changer** ce qui n'existe pas — on propose d'en **définir** un —, et
   * la suppression ne peut pas en demander un comme preuve.
   *
   * Vrai par défaut le temps que la session arrive : afficher « Aucun » puis
   * se raviser serait dire au lecteur qu'il a perdu son mot de passe.
   */
  const hasPassword = account?.hasPassword ?? true;
  const [face, setFace] = useState<Face>(null);
  /** Les deux champs du mot de passe, dépliés sous leur rangée. */
  const [changing, setChanging] = useState(false);
  /** Ce qu'on nous écrit, et ce qu'il en est advenu. */
  const [said, setSaid] = useState("");
  const [sending, setSending] = useState(false);

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
    setSaid("");
    onClose();
  };

  /** Revient au compte depuis la sous-page. */
  const back = () => {
    setFace(null);
    clear();
    /* Le message s'oublie en sortant. Un brouillon qui réapparaît des jours
       plus tard dans une page de réglages est une surprise, pas un service :
       on ne vient pas ici pour reprendre un texte. */
    setSaid("");
    setProblem(null);
  };

  /**
   * Porte le message, puis rend la page du compte.
   *
   * Le succès s'annonce **sur la page d'avant** et non ici : la carte verte de
   * `done` y est déjà, c'est là qu'on atterrit, et une page de formulaire qui
   * se félicite elle-même laisse le lecteur devant un champ vide sans savoir
   * s'il doit recommencer.
   */
  const write = async () => {
    setSending(true);
    setProblem(null);
    try {
      const expedie = await writeToUs(said);
      if (!expedie) {
        /* Gardé mais non expédié : le lecteur n'a rien à en faire — son
           message est bien chez nous —, mais nous si. Il manque la clé
           `RESEND_API_KEY` ou `CONTACT_TO`, et la raison est écrite dans
           `contact_messages.failure`. */
        console.warn("Message gardé sans être expédié — voir contact_messages.");
      }
      back();
      setDone(`Message reçu. Nous répondons ${ANSWER_SAID}.`);
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSending(false);
    }
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
  const ready = (password !== "" || !hasPassword) && isStrong(chosen);

  const change = () =>
    attempt(async () => {
      if (hasPassword) await changePassword(password, chosen);
      else await choosePassword(chosen);
      // Replié, et la phrase le dit : le lecteur a demandé une chose, et des
      // champs qui se vident sans un mot le laissent se demander si ça a pris.
      setChanging(false);
      clear();
      setDone(hasPassword ? "Mot de passe modifié." : "Mot de passe défini.");
    });

  const erase = () =>
    attempt(async () => {
      /* Le seau est vidé **par** `deleteAccount`, entre la preuve d'identité
         et l'effacement : les lignes disparaissent en cascade avec le compte,
         les fichiers non, et il faut encore une session pour les retirer.
         Le faire ici, avant l'appel, l'aurait fait passer avant la preuve —
         et quelqu'un qui referme la feuille de son fournisseur aurait gardé
         son compte et perdu ses photos. */
      const done = await deleteAccount(
        hasPassword ? password : null,
        deleteOwnPhotos,
      );
      if (done === "cancelled") setFace(null);
    });

  const title =
    face === "proving"
      ? "Confirmer la suppression"
      : face === "contact"
        ? "Nous écrire"
        : "Votre compte";

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
          /* Du haut du titre à son bas : la bande qu'il occupe est celle du
             titre, et `justifyContent` l'y centre. L'accrocher par son seul
             bord haut le posait quatre points trop bas — sa boîte de ligne
             fait 34 points contre 30 au titre, et son rembourrage ajoutait
             le reste. */
          style={({ pressed }) => [
            styles.back,
            { top: insets.top + space.sm, bottom: space.md },
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
            /**
             * Pas de rebond tant qu'il n'y a rien à faire défiler.
             *
             * Repliée, cette page tient dans un écran : deux cartes et un
             * pied. Elle tressautait quand même sous le doigt, et un écran
             * qui rebondit sur rien annonce un contenu qu'on n'a pas.
             *
             * `alwaysBounceVertical` et non `bounces` : l'une n'ôte le
             * rebond que lorsqu'il est faux, l'autre l'ôterait aussi quand
             * la page défile vraiment — ce qui arrive dès que le tiroir du
             * mot de passe s'ouvre, car les deux champs, la jauge et les
             * boutons débordent du plus petit des téléphones.
             */
            alwaysBounceVertical={false}
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
                    ? "Replier"
                    : hasPassword
                      ? "Changer le mot de passe"
                      : "Définir un mot de passe"
                }
              >
                {/* Des points plutôt qu'un vide : un mot de passe a une
                    valeur même quand on ne la montre pas. Et un mot plutôt
                    que des points quand il n'y en a pas : huit points
                    laisseraient croire qu'il en existe un, qu'on aurait
                    oublié. */}
                <Text style={styles.value}>
                  {hasPassword ? "••••••••" : "Aucun"}
                </Text>
              </Row>

              {/* Déplié dans la carte, sous la rangée qui l'annonce : c'est
                  cette rangée-là qu'on règle, et la voir juste au-dessus des
                  champs dit laquelle sans qu'un titre ait à le redire. */}
              {changing ? (
                <View style={styles.unfolded}>

                  {/* Proof before choice, in that order: it is the question
                      the reader can answer straight away, and the one that
                      decides whether the rest is worth typing.
                      Rien à prouver quand il n'y a pas de mot de passe : la
                      session en cours est la preuve, et c'est la même règle
                      qu'à la fin d'une réinitialisation. */}
                  {hasPassword ? (
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
                  ) : (
                    <Text style={styles.onDrawerNote}>
                      Vous êtes entré par un compte Apple, Google ou Facebook.
                      Définir un mot de passe ajoute une seconde façon de vous
                      connecter ; l&apos;autre continuera de fonctionner.
                    </Text>
                  )}

                  <InkField
                    style={styles.onDrawer}
                    label={hasPassword ? "Nouveau mot de passe" : "Mot de passe"}
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

              {/* Dans ce groupe et non dans un à part : c'est déjà celui des
                  échanges avec les autres — les avis qu'on reçoit —, et nous
                  écrire en est un. Un groupe d'une rangée pour une seule
                  porte aurait fait un bloc de plus à parcourir. */}
              <Row
                label="Nous contacter"
                onPress={() => go("contact")}
                accessibilityLabel="Nous écrire un message"
              >
                <Text style={styles.value}>Une question, un souci</Text>
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
      ) : face === "contact" ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + space.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          alwaysBounceVertical={false}
        >
          <Text style={styles.lead}>
            Dites-nous ce qui vous amène : une erreur dans une fiche, une
            fonction qui résiste, une idée. Nous répondons à l&apos;adresse de
            votre compte, {ANSWER_SAID}.
          </Text>

          {/* Sans étiquette : le titre du bandeau dit « Nous écrire », et la
              seule chose à faire sur cette page est de taper. */}
          <InkField
            value={said}
            onChangeText={setSaid}
            placeholder="Votre message…"
            multiline
            autoFocus
            /* Majuscule à la première lettre de chaque phrase, et non à
               chaque mot : c'est de la prose, pas un nom propre. */
            autoCapitalize="sentences"
            maxLength={LONGEST}
          />

          {/* Le compte ne paraît qu'à l'approche de la borne. Un compteur
              permanent sous un champ vide donne à une invitation à écrire
              l'air d'un examen. */}
          {said.length > LONGEST - 400 ? (
            <Text style={styles.counter}>
              {LONGEST - said.length} caractères restants
            </Text>
          ) : null}

          {problem === null ? null : (
            <View style={[styles.note, styles.noteBad]}>
              <Text style={styles.noteBadText}>{problem}</Text>
            </View>
          )}

          <InkButton
            label={sending ? "Envoi…" : "Envoyer"}
            variant="solid"
            /* Dix caractères, comme la contrainte de la table : un bouton
               qu'on peut presser pour se faire refuser par la base est un
               bouton qui ment. */
            disabled={sending || said.trim().length < SHORTEST}
            onPress={() => void write()}
          />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + space.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          alwaysBounceVertical={false}
        >
          <Image
            source={ALERT}
            style={styles.alert}
            resizeMode="contain"
            /* Décoratif : ce qu'il annonce est écrit juste dessous, et un
               lecteur d'écran qui dirait « alerte » avant de lire la phrase
               ne ferait que la redire. */
            accessible={false}
          />

          <Text style={styles.lead}>
            Événements, personnages, arbres et photos seront effacés.
            C&apos;est définitif. Aucune possibilité de récupération.{" "}
            {hasPassword
              ? "Tapez votre mot de passe pour confirmer."
              : "Vous devrez vous reconnecter à votre compte pour confirmer."}
          </Text>

          {/* La preuve qu'il s'agit bien de vous, et non d'un téléphone laissé
              sur une table. Sans mot de passe, c'est la feuille du
              fournisseur qui la donne — elle s'ouvre au moment de presser le
              bouton, et la refermer annule la suppression. */}
          {hasPassword ? (
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
          ) : null}

          {problem === null ? null : (
            <View style={[styles.note, styles.noteBad]}>
              <Text style={styles.noteBadText}>{problem}</Text>
            </View>
          )}

          <InkButton
            label={busy ? "Suppression…" : "Supprimer le compte"}
            variant="solid"
            tone="danger"
            disabled={busy || (hasPassword && password === "")}
            onPress={() => void erase()}
          />
        </ScrollView>
      )}

      <ConfirmDialog
        visible={asking === "leaving"}
        title="Se déconnecter ?"
        message="Il faudra vous reconnecter."
        confirmLabel="Valider"
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
        message="Cette action est définitive. Vos données seront supprimées et il sera impossible de les récupérer"
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
            onChanged={onNoticesChanged}
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
  /**
   * Le chevron, aligné sur le titre et non sur le haut du bandeau.
   *
   * Ses bords haut et bas sont posés au rendu, à la mesure du rembourrage du
   * bandeau : il couvre exactement la bande du titre. Le rembourrage est
   * horizontal seulement — un rembourrage vertical le décentrerait de ce
   * qu'on vient d'aligner, et c'est le `hitSlop` qui donne la cible.
   */
  back: {
    position: "absolute",
    left: space.sm,
    justifyContent: "center",
    paddingHorizontal: space.xs,
  },
  /**
   * Trois points vers le haut, et c'est une correction **optique**.
   *
   * Sa boîte est centrée sur celle du titre au point près — mais un glyphe
   * qui ne remplit pas sa boîte n'est pas centré pour autant : le « ‹ » est
   * dessiné sur la ligne de base, et l'espace réservé à l'ascendante
   * au-dessus de lui le fait reposer dans le bas de sa propre ligne. Aucune
   * mise en page ne corrige cela ; seul l'œil le voit, et c'est lui qui
   * décide. La croix des cartes porte le même décalage, pour la même raison.
   */
  backGlyph: {
    fontSize: 30,
    lineHeight: 32,
    marginTop: -3,
    color: palette.inkSoft,
  },
  down: { opacity: 0.55 },

  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.xl,
    gap: space.xl,
  },
  /** Une phrase d'ouverture, en tête d'une sous-page. */
  /**
   * Le panneau d'alerte, centré au-dessus du texte.
   *
   * Carré dans son fichier, donc une seule mesure suffit — et `contain`
   * plutôt que `cover`, pour que le triangle garde ses proportions quoi qu'il
   * arrive au cadre.
   *
   * Un peu d'air en plus au-dessus : il ouvre la page, et la gouttière de
   * vingt points qui sépare les blocs du corps le collerait au bandeau.
   *
   * `maxWidth` est une précaution que la taille actuelle ne réclame plus,
   * et qu'on garde : deux cents points passent partout, trois cents
   * débordaient de la page sur un écran de trois cent vingt, où il n'en
   * reste que deux cent quatre-vingt-huit. Le plafond ramène à la page, et
   * `contain` fait le reste — l'image s'inscrit dans ce qu'on lui laisse
   * sans jamais s'étirer.
   */
  alert: {
    width: 200,
    height: 200,
    maxWidth: "100%",
    alignSelf: "center",
    marginTop: space.sm,
  },
  lead: { ...type.body, color: palette.inkSoft },

  group: { gap: space.sm },
  legend: { ...type.legend, color: palette.inkFaint, paddingLeft: space.xs },
  /** Le décompte des caractères restants, à l'approche de la borne. */
  counter: {
    ...type.caption,
    color: palette.inkFaint,
    textAlign: "right",
    paddingRight: space.xs,
  },
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
  /** Une phrase dans le tiroir, à la place du champ qu'elle remplace. */
  onDrawerNote: { ...type.caption, color: palette.inkSoft },
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
  /**
   * Le rouge posé sur le papier, et le dessin plein par-dessus.
   *
   * `dangerWash` est écrit dans la palette pour ce rôle — « le fond d'un
   * panneau d'avertissement, là où un rouge plein crierait et un gris ne
   * dirait rien ». Le filet qui cernait celui-ci est parti avec son fond
   * blanc : un liseré crème autour d'un lavis rouge aurait fait deux bords
   * pour une seule forme, et le lavis se détache déjà seul.
   *
   * Opaque et non translucide : un lavis transparent se poserait autrement
   * sur chaque fond, et la même poubelle n'aurait pas deux fois la même
   * couleur d'un écran à l'autre.
   */
  bin: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: palette.dangerWash,
  },
  /** Déjà rouge, et il le reste : 5,1:1 sur son lavis. */
  binGlyph: { width: 19, height: 19, tintColor: palette.danger },

  /** La gouttière des feuilles, que la feuille ne pose pas elle-même. */
  scrolled: {
    paddingHorizontal: space.xl,
    paddingVertical: space.xs,
    paddingBottom: space.lg,
  },
});
