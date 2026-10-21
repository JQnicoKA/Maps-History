import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import {
  attach,
  dismiss,
  fetchNotices,
  nameOf,
  type Notice,
  type NoticeKind,
} from "./notices";
import { NoticeRow } from "./NoticeRow";
import { ConfirmDialog, InkButton, useNotice } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { useMyPlaces } from "../places/MyPlacesProvider";
import { useHidden } from "../territories/HiddenProvider";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

const TRASH = require("../../../assets/icons/trash.png");

/**
 * Ce que ce lecteur n'a pas encore lu, et de quoi le relire.
 *
 * Tenu ici plutôt que dans un fournisseur : la question est posée à
 * l'ouverture de la carte du compte et nulle part ailleurs, elle ne coûte
 * qu'une requête, et presque toujours elle revient vide. Un état de plus à
 * tenir à jour dans toute l'application coûterait plus cher que la question.
 */
export function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);

  const reload = useCallback(async () => {
    try {
      setNotices(await fetchNotices());
    } catch {
      // Muet : personne n'a demandé cette question. Un « le réseau a
      // refusé » sur une carte de compte serait du bruit pur.
    }
  }, []);

  useEffect(() => void reload(), [reload]);

  return { notices, reload };
}

/** Ce que la notification annonce, en une ligne de titre. */
function heading(one: Notice): string {
  if (one.sort === "stale") return "Une mise à jour existe";
  if (one.sort === "promoted") {
    return one.kind === "place"
      ? "Votre ville est sur la carte de tous"
      : "Votre territoire est sur la carte de tous";
  }
  return `Votre ${nameOf(one.kind)} est entré dans la bibliothèque`;
}

/**
 * Ce qu'on perd en masquant, et c'est différent pour chacune.
 *
 * Une seule phrase pour les trois aurait menti deux fois : une mise à jour se
 * retrouve, un rattachement non, et une promotion n'a rien à retrouver. Un
 * avertissement qui exagère sur deux cas est un avertissement qu'on apprend à
 * ne pas lire.
 */
function cost(one: Notice): string {
  if (one.sort === "stale") {
    // `dismissed` compare les dates pour cette sorte — voir `my_notices` : une
    // correction postérieure au masquage ramène la ligne.
    return "La mise à jour restera disponible depuis la fiche de votre élément, et une nouvelle correction de la bibliothèque la ramènera ici.";
  }
  if (one.sort === "promoted") {
    return "Il n'y a rien à retrouver : cette ligne ne faisait que vous annoncer la nouvelle, et ce qu'elle annonce reste vrai.";
  }
  return one.attachable
    ? "Vous perdez l'offre de rattacher votre ligne à l'entrée publiée : elle n'est proposée qu'ici, et elle ne reviendra pas. Votre ligne et l'entrée restent, chacune de son côté."
    : "Il n'y a rien à retrouver : votre ligne n'existe plus, et l'entrée de la bibliothèque reste.";
}

/** Et ce qu'elle dit vraiment, y compris ce qu'elle coûte. */
function detail(one: Notice): string {
  if (one.sort === "stale") {
    // La question est posée, et la rangée entière y répond : la toucher mène
    // à la version corrigée, où le geste se trouve. Plus de bouton ici — un
    // « Mettre à jour » demandait d'accepter sans avoir rien lu.
    //
    // Et pas un mot de ce que la reprise écrase : la fenêtre qui la demande
    // le dit déjà, au moment où ça compte. Le redire ici avertirait contre un
    // geste qu'on ne fait pas en touchant cette rangée.
    return `Une mise à jour de l'élément « ${one.title} » existe. Voulez-vous mettre à jour votre élément ?`;
  }
  if (one.sort === "promoted") {
    return `« ${one.title} » a été vérifié et ajouté au fond de carte : tous les lecteurs le voient désormais. Il a quitté votre liste, où il ferait doublon. Vous pouvez le retirer de votre carte comme n'importe quel autre.`;
  }
  return one.attachable
    ? `« ${one.title} » a été relu et repris. Rattacher votre ${nameOf(one.kind)} vous donnera les corrections de la bibliothèque, par bouton et jamais sans vous. En échange, votre case « proposer » se refermera : la bibliothèque a déjà votre apport.`
    : `« ${one.title} » a été relu et repris. Votre ligne n'existe plus, il n'y a donc rien à y rattacher.`;
}

export type NoticeListProps = {
  notices: Notice[];
  /** Une notification a été traitée ou balayée : la liste doit se relire. */
  onChanged: () => void;
  /**
   * Demande la fiche d'une entrée de la bibliothèque, dans le catalogue.
   *
   * Pour « Voir » : on y lit la version corrigée, et c'est elle qui porte le
   * bouton de reprise. On ne reprend plus à l'aveugle une version dont on ne
   * sait rien — et dont la reprise peut écraser son propre travail.
   */
  onSee: (kind: NoticeKind, entry: string) => void;
};

/**
 * Les notifications, et le seul geste que chacune mérite.
 *
 * Rien ne s'applique sans un oui, et c'est la même règle qu'ailleurs : la
 * carte de quelqu'un ne doit pas bouger pendant la nuit. Les deux fenêtres de
 * confirmation ne redisent donc pas le titre — elles disent ce qu'on perd.
 */
export function NoticeList({ notices, onChanged, onSee }: NoticeListProps) {
  const [asking, setAsking] = useState<Notice | null>(null);
  /**
   * Celle qu'on s'apprête à masquer, le temps de le confirmer.
   *
   * Masquer était immédiat, et c'était la seule chose irréversible de cette
   * liste faite sans un oui — pour une notification d'admission, le
   * rattachement part avec elle et ne revient pas.
   */
  const [sweeping, setSweeping] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const { say, dialog } = useNotice();
  /**
   * Les trois listes que ces gestes rendent fausses.
   *
   * Rattacher change le statut d'une ligne — sa case « proposer » se
   * verrouille, l'avertissement de suppression s'adoucit — et reprendre
   * réécrit son texte : la collection tenue en mémoire ne le sait pas.
   *
   * Et une promotion a supprimé la ligne côté serveur avant même que la
   * notification n'existe, donc la liste des villes en montre encore une qui
   * n'est plus là. C'est à cela que servaient les deux `reload` de ces
   * fournisseurs, que la disparition du catalogue des villes avait laissés
   * sans appelant.
   */
  const { refresh } = useEvents();
  const { reload: reloadPlaces } = useMyPlaces();
  const { reload: reloadTerritories } = useHidden();

  const trouble = (what: string) => (cause: unknown) =>
    say(what, cause instanceof Error ? cause.message : String(cause));

  /**
   * Le oui du rattachement, et c'est le seul qui reste ici.
   *
   * La reprise en demandait un aussi — « votre exemplaire sera entièrement
   * réécrit » — mais elle le demandait **à l'aveugle**, sans montrer par quoi.
   * Elle est partie sur la fiche de l'entrée corrigée : on y lit la version
   * qu'on va recevoir, puis on décide. Ce bouton-ci n'y mène plus que.
   */
  const agree = () => {
    if (asking === null) return;
    const one = asking;
    setBusy(true);
    void attach(one.kind, one.sourceId)
      .then(async () => {
        setAsking(null);
        await refresh();
        onChanged();
      })
      .catch(trouble("Rattachement impossible"))
      .finally(() => setBusy(false));
  };

  const sweep = () => {
    if (sweeping === null) return;
    const one = sweeping;
    setBusy(true);
    setSweeping(null);
    void dismiss(one.sort, one.kind, one.sourceId)
      .then(async () => {
        // Le moment où le lecteur prend acte : c'est là qu'on peut relire la
        // liste dont sa ville a disparu sans qu'il l'ait demandé.
        if (one.sort === "promoted") {
          await (one.kind === "place" ? reloadPlaces() : reloadTerritories());
        }
        onChanged();
      })
      .catch(trouble("Impossible de la masquer"))
      .finally(() => setBusy(false));
  };

  if (notices.length === 0) {
    return (
      <Text style={styles.nothing}>
        Rien de neuf. Vous verrez ici ce que la bibliothèque fait de vos
        propositions, et les entrées qu'elle corrige après que vous les ayez
        prises.
      </Text>
    );
  }

  return (
    <View style={styles.all}>
      {dialog}

      {/* La reprise, elle, a sa fenêtre sur la fiche de l'entrée qu'elle va
          recopier : on y décide devant le texte qu'on recevra. */}
      <ConfirmDialog
        visible={asking !== null}
        title="Rattacher à la bibliothèque ?"
        message="Votre ligne devient un exemplaire de l'entrée publiée. Vous recevrez ses corrections par bouton, et la supprimer ne coûtera plus rien — l'entrée de la bibliothèque restera. Votre texte n'est pas touché aujourd'hui : la première reprise, elle, l'écrasera."
        confirmLabel={busy ? "…" : "Rattacher"}
        tone="ink"
        cancelLabel="Annuler"
        veil="soft"
        onConfirm={agree}
        onClose={() => setAsking(null)}
      />

      <ConfirmDialog
        visible={sweeping !== null}
        title="Masquer la notification ?"
        message={sweeping === null ? "" : cost(sweeping)}
        confirmLabel={busy ? "…" : "Masquer"}
        /* Rouge seulement là où quelque chose se perd pour de bon. Une mise à
           jour se retrouve, une promotion n'a rien à retrouver ; le
           rattachement, lui, part avec la ligne. */
        tone={sweeping?.sort === "admitted" && sweeping.attachable ? "danger" : "ink"}
        cancelLabel="Annuler"
        /* Elle s'ouvre depuis la feuille des notifications, qui a déjà posé
           son voile. */
        veil="soft"
        onConfirm={sweep}
        onClose={() => setSweeping(null)}
      />

      {notices.map((one) => {
        /* Toucher la rangée mène à l'entrée dont elle parle — sauf pour une
           promotion, dont la ligne n'existe plus : il n'y a rien à ouvrir, et
           une rangée qui s'enfonce sous le doigt sans rien faire est pire
           qu'une rangée inerte. */
        const opens = one.sort !== "promoted";
        return (
          <NoticeRow
            key={`${one.sort}:${one.kind}:${one.sourceId}`}
            photo={one.photo}
            title={one.title}
            heading={heading(one)}
            detail={detail(one)}
            disabled={busy}
            {...(opens
              ? { onPress: () => onSee(one.kind, one.entryId) }
              : {})}
            // Rattacher n'a pas d'autre porte que celle-ci : c'est le seul
            // bouton qui reste, et seulement là où il mène quelque part. Sous
            // le texte et non en troisième colonne — entre un visage, une
            // phrase et une poubelle, il ne resterait rien pour le mot.
            {...(one.sort === "admitted" && one.attachable
              ? {
                  under: (
                    <InkButton
                      label="Rattacher"
                      variant="tonal"
                      disabled={busy}
                      onPress={() => setAsking(one)}
                    />
                  ),
                }
              : {})}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Masquer — ${one.title}`}
                hitSlop={8}
                disabled={busy}
                onPress={() => setSweeping(one)}
                style={({ pressed }) => [styles.bin, pressed && styles.down]}
              >
                <Image source={TRASH} style={styles.binGlyph} />
              </Pressable>
            }
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  all: { gap: space.sm },
  down: { opacity: 0.6 },
  /* Le visage, le texte et leurs mesures sont partis dans `NoticeRow` : la
     fiche d'un élément en retard porte exactement la même rangée, et deux
     copies auraient dérivé au premier changement. */
  /**
   * Un bouton rouge, et non une icône posée sur le papier.
   *
   * Toute la rangée est touchable désormais — elle mène à la mise à jour — et
   * une poubelle en encre pâle au bout aurait eu l'air d'en faire partie. Le
   * rouge dit que celle-ci est l'autre geste, et qu'il retire quelque chose.
   */
  /**
   * Le rouge posé sur le papier, et le dessin plein par-dessus.
   *
   * `dangerWash` est écrit dans la palette pour ce rôle — « le fond d'un
   * panneau d'avertissement, là où un rouge plein crierait et un gris ne
   * dirait rien ». Celui-ci portait le rouge **plein**, et il criait : balayer
   * une notification n'efface rien qu'on regrette.
   *
   * Opaque et non translucide : un lavis transparent se poserait autrement
   * sur chaque fond, et la même poubelle n'aurait pas deux fois la même
   * couleur d'un écran à l'autre.
   */
  bin: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: palette.dangerWash,
  },
  /** Crème sur le rouge : le glyphe est tracé en encre dans sa source. */
  /** 5,1:1 sur son lavis, et à pleine opacité. */
  binGlyph: { width: 17, height: 17, tintColor: palette.danger },
  nothing: { ...type.caption, color: palette.inkSoft },
});
