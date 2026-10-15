import { useCallback, useEffect, useState } from "react";

import { NoticeRow } from "./NoticeRow";
import { fetchStale, type Stale } from "./updates";
import type { Kind } from "./types";

export type UpdateRowProps = {
  kind: Kind;
  /** La ligne du lecteur. Null quand on est en train d'en créer une. */
  id: string | null;
  /**
   * Demande la fiche de l'entrée corrigée, dans le catalogue.
   *
   * C'est là que la reprise se fait maintenant. Ce bouton ne reprenait rien
   * sans un oui, mais ce oui était demandé **à l'aveugle** : « votre
   * exemplaire sera entièrement réécrit » sans montrer par quoi. On va donc
   * lire la version de la bibliothèque, et c'est sa fiche qui porte le geste.
   */
  onSee: (entry: string) => void;
};

/**
 * « La bibliothèque a corrigé cette entrée depuis que vous l'avez prise. »
 *
 * **Absente quand il n'y a rien à reprendre**, et c'est la moitié de son
 * intérêt. Un bouton permanent qui répond « vous êtes déjà à jour » est pire
 * que pas de bouton : il demande qu'on aille vérifier, et apprend à ne plus
 * vérifier.
 *
 * Elle interroge elle-même plutôt que de recevoir sa réponse d'un
 * fournisseur. `stale()` ne rend que ce qui est en retard — donc presque
 * toujours rien — et le coût d'une question à l'ouverture d'un formulaire est
 * inférieur à celui d'un état de plus à tenir à jour dans toute
 * l'application.
 *
 * Rien n'est repris sans un oui. La carte de quelqu'un ne doit pas bouger
 * pendant la nuit : c'était l'argument contre la propagation automatique, et
 * il tient toujours — le oui se demande simplement une page plus loin,
 * devant le texte qu'on va recevoir.
 */
export function UpdateRow({ kind, id, onSee }: UpdateRowProps) {
  const [behind, setBehind] = useState<Stale | null>(null);

  const look = useCallback(() => {
    if (id === null) return;
    let alive = true;
    void fetchStale()
      .then((all) => {
        if (!alive) return;
        setBehind(
          all.find((one) => one.kind === kind && one.id === id) ?? null,
        );
      })
      // Muet : personne n'a demandé cette question, et y répondre « le
      // réseau a refusé » au-dessus d'un formulaire serait du bruit.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [kind, id]);

  useEffect(() => look(), [look]);

  if (behind === null) return null;

  /* Exactement la rangée des notifications, et la même phrase : c'est la même
     nouvelle, rencontrée à un autre endroit. Elle avait ici un bloc à elle et
     un bouton « Voir » au pied ; deux dessins pour une chose finissent par
     diverger, et celui-là n'avait aucune raison d'être le second. */
  return (
    <NoticeRow
      photo={behind.photo}
      title={behind.title}
      heading="Une mise à jour existe"
      detail={`Une mise à jour de l'élément « ${behind.title} » existe. Voulez-vous mettre à jour votre élément ?`}
      onPress={() => onSee(behind.entry)}
    />
  );
}
