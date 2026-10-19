import { useMemo } from "react";

import { CollectionPage } from "./CollectionPage";
import { EventSummaryCard } from "../../features/events/components/EventSummaryCard";
import { useEvents } from "../../features/events/EventsProvider";
import { toSortKey } from "../../features/events/historicalDate";
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
 * **Les filtres ne gouvernent pas cette page**, et c'est un changement. La
 * vue liste qu'elle remplace lisait `visibleEvents`, donc les calques et
 * l'étendue réglés dans le filtre la restreignaient aussi. Le filtre
 * appartient désormais à la carte seule : il n'est atteignable que de là, et
 * un réglage invisible depuis cette page qui en cacherait la moitié ne
 * s'expliquerait par rien. Une page nommée « Événements » montre les
 * événements.
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

  const ordered = useMemo<EventSummary[]>(
    /* Une copie avant de trier : `events` vient du fournisseur, et le trier
       en place réordonnerait la collection pour tout le monde, carte
       comprise. */
    () => [...events].sort((a, b) => toSortKey(a.start) - toSortKey(b.start)),
    [events],
  );

  return (
    <CollectionPage
      title="Événements"
      owned="Vos événements"
      count={events.length}
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
      empty="Votre collection est vide. Écrivez un événement, ou cherchez-en un dans la bibliothèque."
      loading={loading}
      failed={error}
      onRetry={() => void refresh()}
      unread={unread}
      onProfile={onProfile}
    />
  );
}
