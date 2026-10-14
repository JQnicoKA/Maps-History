import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  attach,
  dismiss,
  fetchNotices,
  nameOf,
  type Notice,
} from "./notices";
import { refreshFromLibrary } from "./updates";
import { ConfirmDialog, InkButton, useNotice } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { useMyPlaces } from "../places/MyPlacesProvider";
import { useHidden } from "../territories/HiddenProvider";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

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
  if (one.sort === "stale") return "Une nouvelle version existe";
  if (one.sort === "promoted") {
    return one.kind === "place"
      ? "Votre ville est sur la carte de tous"
      : "Votre territoire est sur la carte de tous";
  }
  return `Votre ${nameOf(one.kind)} est entré dans la bibliothèque`;
}

/** Et ce qu'elle dit vraiment, y compris ce qu'elle coûte. */
function detail(one: Notice): string {
  if (one.sort === "stale") {
    return one.touched
      ? `La bibliothèque a corrigé « ${one.title} ». La reprendre écrasera vos propres modifications.`
      : `La bibliothèque a corrigé « ${one.title} » depuis que vous l'avez pris.`;
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
};

/**
 * Les notifications, et le seul geste que chacune mérite.
 *
 * Rien ne s'applique sans un oui, et c'est la même règle qu'ailleurs : la
 * carte de quelqu'un ne doit pas bouger pendant la nuit. Les deux fenêtres de
 * confirmation ne redisent donc pas le titre — elles disent ce qu'on perd.
 */
export function NoticeList({ notices, onChanged }: NoticeListProps) {
  const [asking, setAsking] = useState<Notice | null>(null);
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

  /** Le oui, pour les deux genres qui en demandent un. */
  const agree = () => {
    if (asking === null) return;
    const one = asking;
    setBusy(true);
    const deed =
      one.sort === "stale"
        ? // Le genre est forcément un événement ou un personnage : `stale()`
          // ne regarde que ces deux tables, les seules à avoir des
          // exemplaires dans la bibliothèque.
          refreshFromLibrary(
            one.kind === "character" ? "character" : "event",
            one.sourceId,
          )
        : attach(one.kind, one.sourceId);
    void deed
      .then(async () => {
        setAsking(null);
        await refresh();
        onChanged();
      })
      .catch(
        trouble(one.sort === "stale" ? "Reprise impossible" : "Rattachement impossible"),
      )
      .finally(() => setBusy(false));
  };

  const sweep = (one: Notice) => {
    setBusy(true);
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

      <ConfirmDialog
        visible={asking !== null}
        title={
          asking?.sort === "stale"
            ? "Reprendre la version de la bibliothèque ?"
            : "Rattacher à la bibliothèque ?"
        }
        /* Deux tons pour la reprise, et c'est une ligne de code : sans
           modification il n'y a rien à perdre, et agiter un avertissement
           devant quelqu'un qui ne risque rien lui apprend à les ignorer
           tous. */
        message={
          asking === null
            ? ""
            : asking.sort === "stale"
              ? asking.touched
                ? "Votre exemplaire sera entièrement réécrit : le texte, les dates, le lieu, et les photographies que vous y avez ajoutées. Ce que vous avez modifié sera perdu."
                : "Vous n'avez rien modifié sur votre exemplaire : rien ne sera perdu."
              : "Votre ligne devient un exemplaire de l'entrée publiée. Vous recevrez ses corrections par bouton, votre case « proposer » se refermera, et la supprimer ne coûtera plus rien — l'entrée de la bibliothèque restera. Votre texte n'est pas touché aujourd'hui : la première reprise, elle, l'écrasera."
        }
        confirmLabel={
          busy ? "…" : asking?.sort === "stale" ? "Reprendre" : "Rattacher"
        }
        tone={asking?.sort === "stale" && asking.touched ? "danger" : "ink"}
        cancelLabel="Annuler"
        onConfirm={agree}
        onClose={() => setAsking(null)}
      />

      {notices.map((one) => (
        <View key={`${one.sort}:${one.kind}:${one.sourceId}`} style={styles.frame}>
          <View style={styles.said}>
            <Text style={styles.title}>{heading(one)}</Text>
            <Text style={styles.detail}>{detail(one)}</Text>
          </View>

          <View style={styles.answers}>
            {one.sort === "stale" ? (
              <InkButton
                label="Mettre à jour"
                variant="tonal"
                disabled={busy}
                onPress={() => setAsking(one)}
              />
            ) : one.sort === "admitted" && one.attachable ? (
              <InkButton
                label="Rattacher"
                variant="tonal"
                disabled={busy}
                onPress={() => setAsking(one)}
              />
            ) : null}

            <InkButton
              label="Masquer"
              variant="quiet"
              disabled={busy}
              onPress={() => sweep(one)}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  all: { gap: space.sm },
  frame: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  said: { gap: 2 },
  title: { ...type.legend, color: palette.ink },
  detail: { ...type.caption, color: palette.inkSoft },
  answers: { flexDirection: "row", alignItems: "center", gap: space.sm },
  nothing: { ...type.caption, color: palette.inkSoft },
});
