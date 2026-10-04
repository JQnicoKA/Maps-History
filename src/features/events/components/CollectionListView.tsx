import { useEffect, useMemo, useRef } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { CharacterSummaryCard } from "./CharacterSummaryCard";
import { EventSummaryCard } from "./EventSummaryCard";
import { useEvents } from "../EventsProvider";
import { toSortKey } from "../historicalDate";
import { momentOf } from "../lifespan";
import type { Character, EventSummary } from "../types";
import { palette } from "../../../theme/palette";

/** Une ligne de la liste : ce qui s'est passé, ou qui l'a fait. */
type Entry =
  | { kind: "event"; at: number; event: EventSummary }
  | { kind: "person"; at: number; person: Character };

export type CollectionListViewProps = {
  /** Ouvre l'événement actuellement sélectionné. */
  onOpenEvent: () => void;
  onOpenPerson: (id: string) => void;
  /** Clears the floating chrome the screen draws over this view. */
  contentPadding: { top: number; bottom: number };
};

/**
 * La collection, en colonne : les événements et les gens, mêlés par la date.
 *
 * Mêlés et non séparés en deux sections, parce que c'est la seule lecture qui
 * ait un sens ici — l'application entière est bâtie sur un axe du temps, et
 * une personne naît au milieu des événements de son siècle. La carte dit la
 * même chose autrement : chacun s'y tient de sa naissance à sa mort.
 *
 * Les calques des filtres gouvernent les deux colonnes de la même main : ôter
 * les personnages de la carte les ôte d'ici. Les territoires, eux, n'ont pas
 * de ligne — ils n'existent que dessinés.
 *
 * **L'année lue ne filtre pas cette liste**, à la différence de la carte. La
 * frise sélectionne, la liste recense : on y fait défiler une collection,
 * pas un instant.
 */
export function CollectionListView({
  onOpenEvent,
  onOpenPerson,
  contentPadding,
}: CollectionListViewProps) {
  const { visibleEvents, characters, filters, selectedEvent, selectEvent } =
    useEvents();
  const listRef = useRef<FlatList<Entry>>(null);

  const entries = useMemo<Entry[]>(() => {
    const rows: Entry[] = visibleEvents.map((event) => ({
      kind: "event",
      at: toSortKey(event.start),
      event,
    }));

    // Tous les personnages, et non ceux que la carte montre à l'année lue :
    // `visibleCharacters` répond à « qui est vivant maintenant », une question
    // de carte. Ici on recense.
    if (filters.characters) {
      for (const person of characters) {
        rows.push({ kind: "person", at: momentOf(person), person });
      }
    }

    // `at` vaut -Infinity pour qui n'a ni naissance ni mort : les non datés
    // remontent en tête, en vue plutôt qu'enterrés — c'est la règle de
    // `compareByLife`, et elle ne doit pas se contredire d'une vue à l'autre.
    return rows.sort((a, b) => a.at - b.at);
  }, [visibleEvents, characters, filters.characters]);

  const index = entries.findIndex(
    (entry) => entry.kind === "event" && entry.event.id === selectedEvent?.id,
  );

  useEffect(() => {
    if (index >= 0) {
      listRef.current?.scrollToIndex({
        index,
        viewPosition: 0.5,
        animated: true,
      });
    }
  }, [index]);

  return (
    <FlatList
      ref={listRef}
      data={entries}
      keyExtractor={(entry) =>
        entry.kind === "event" ? `e:${entry.event.id}` : `p:${entry.person.id}`
      }
      contentContainerStyle={[
        styles.content,
        { paddingTop: contentPadding.top, paddingBottom: contentPadding.bottom },
      ]}
      // Tiles are not a fixed height, so the exact offset is unknown until the
      // rows are measured; fall back to the running average and let the next
      // pass correct it.
      onScrollToIndexFailed={(info) =>
        listRef.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: true,
        })
      }
      renderItem={({ item }) =>
        item.kind === "event" ? (
          <EventSummaryCard
            event={item.event}
            highlighted={item.event.id === selectedEvent?.id}
            onOpen={() => {
              selectEvent(item.event.id);
              onOpenEvent();
            }}
          />
        ) : (
          <CharacterSummaryCard
            person={item.person}
            onOpen={() => onOpenPerson(item.person.id)}
          />
        )
      }
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListEmptyComponent={
        <Text style={styles.empty}>Rien à montrer pour ces filtres.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 10 },
  gap: { height: 8 },
  empty: {
    paddingVertical: 24,
    textAlign: "center",
    fontSize: 13,
    color: palette.inkSoft,
  },
});
