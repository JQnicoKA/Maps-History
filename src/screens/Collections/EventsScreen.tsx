import { useMemo, useState } from "react";

import { CollectionPage } from "./CollectionPage";
import { EventSummaryCard } from "../../features/events/components/EventSummaryCard";
import { SiftButton } from "../../features/events/components/SiftButton";
import { useEvents } from "../../features/events/EventsProvider";
import { toSortKey } from "../../features/events/historicalDate";
import { NO_SIFT, kept, type Sift } from "../../features/events/sift";
import type { EventSummary } from "../../features/events/types";

export type EventsScreenProps = {
  /** Ouvre la fiche d'un événement. */
  onOpen: (id: string) => void;
  /** Demande le formulaire, vierge. */
  onCreate: () => void;
  /** Demande le catalogue de la bibliothèque, côté événements. */
  onSeek: () => void;
  /** La porte du compte, au bord du bandeau — voir `CollectionPage`. */
  unread: number;
  onProfile: () => void;
};

/**
 * Les événements de la collection, en colonne, par ordre chronologique.
 *
 * **Le filtre de la carte ne gouverne pas cette page**, et c'est un
 * changement ancien. La vue liste qu'elle remplace lisait `visibleEvents`,
 * donc les calques et l'étendue réglés sur la planche la restreignaient
 * aussi : un réglage invisible d'ici en cachait la moitié, sans que rien ne
 * l'explique.
 *
 * Elle a désormais **son** tamis, qui est une autre affaire : il vit sur
 * cette page, il se voit — la pastille porte son compte —, et il ne cache
 * rien ailleurs. Deux questions seulement, celles que la collection se pose :
 * dans quel classeur, et de quelle importance.
 *
 * **L'année lue ne la filtre pas non plus.** La frise sélectionne, la liste
 * recense : on y fait défiler une collection, pas un instant — et la frise
 * n'existe plus que sur la carte.
 */
export function EventsScreen({
  onOpen,
  onCreate,
  onSeek,
  unread,
  onProfile,
}: EventsScreenProps) {
  const { events, selectedEvent, selectEvent, loading, error, refresh } =
    useEvents();
  const [sift, setSift] = useState<Sift>(NO_SIFT);

  const ordered = useMemo<EventSummary[]>(
    /* `kept` rend déjà une copie, donc trier ici ne réordonne pas la
       collection du fournisseur — ce que la carte lit aussi. */
    () =>
      kept(events, sift).sort((a, b) => toSortKey(a.start) - toSortKey(b.start)),
    [events, sift],
  );

  return (
    <CollectionPage
      title="Événements"
      owned="Vos événements"
      count={ordered.length}
      total={events.length}
      tools={<SiftButton value={sift} onChange={setSift} />}
      seekLabel="Rechercher un événement"
      onSeek={onSeek}
      addLabel="Créer un événement"
      onAdd={onCreate}
      data={ordered}
      keyOf={(one) => one.id}
      row={(one) => (
        <EventSummaryCard
          event={one}
          highlighted={one.id === selectedEvent?.id}
          onOpen={() => {
            /* Sélectionner avant d'ouvrir : la fiche lit l'événement
               sélectionné, et la carte se cale dessus au retour. */
            selectEvent(one.id);
            onOpen(one.id);
          }}
        />
      )}
      empty={
        events.length === 0
          ? "Votre collection est vide. Écrivez un événement, ou cherchez-en un dans la bibliothèque."
          : "Aucun événement ne répond à ces filtres."
      }
      loading={loading}
      failed={error}
      onRetry={() => void refresh()}
      unread={unread}
      onProfile={onProfile}
    />
  );
}
