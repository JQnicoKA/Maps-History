import { Marker } from "@maplibre/maplibre-react-native";

import { EventMarker, type MarkerVariant } from "./EventMarker";
import { useEvents } from "../EventsProvider";
import type { HistoricalEvent } from "../types";

/**
 * At most three markers stand on the plate at once — the event being read, the
 * one before and the one after. Capping it there is what buys us real
 * photographs as markers instead of the flat glyphs a whole collection would
 * have forced.
 *
 * The current one is rendered last so it sits above its neighbours.
 */
export function EventMarkers() {
  const { neighbours, selectEvent } = useEvents();

  const shown: { event: HistoricalEvent; variant: MarkerVariant }[] = [
    ...(neighbours.previous
      ? [{ event: neighbours.previous, variant: "previous" as const }]
      : []),
    ...(neighbours.next
      ? [{ event: neighbours.next, variant: "next" as const }]
      : []),
    ...(neighbours.current
      ? [{ event: neighbours.current, variant: "current" as const }]
      : []),
  ];

  return (
    <>
      {shown.map(({ event, variant }) => (
        <Marker key={event.id} lngLat={[event.longitude, event.latitude]}>
          <EventMarker
            event={event}
            variant={variant}
            onPress={() => selectEvent(event.id)}
          />
        </Marker>
      ))}
    </>
  );
}
