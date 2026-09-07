import { useEffect, useRef } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { EventSummaryCard } from "./EventSummaryCard";
import { useEvents } from "../EventsProvider";
import type { HistoricalEvent } from "../types";
import { palette } from "../../../theme/palette";

export type EventListViewProps = {
  onOpen: () => void;
  /** Clears the floating chrome the screen draws over this view. */
  contentPadding: { top: number; bottom: number };
};

/**
 * The same tiles as the one above the timeline, stacked. Selecting through the
 * arrows or the frieze scrolls the list, so both views always agree on where
 * the reader is.
 */
export function EventListView({ onOpen, contentPadding }: EventListViewProps) {
  const { visibleEvents, selectedEvent, selectEvent } = useEvents();
  const listRef = useRef<FlatList<HistoricalEvent>>(null);

  const index = visibleEvents.findIndex(
    (event) => event.id === selectedEvent?.id,
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
      data={visibleEvents}
      keyExtractor={(event) => event.id}
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
      renderItem={({ item }) => (
        <EventSummaryCard
          event={item}
          highlighted={item.id === selectedEvent?.id}
          onOpen={() => {
            selectEvent(item.id);
            onOpen();
          }}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListEmptyComponent={
        <Text style={styles.empty}>Aucun événement pour ces filtres.</Text>
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
