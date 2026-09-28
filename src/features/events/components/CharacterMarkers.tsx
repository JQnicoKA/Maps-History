import { Marker } from "@maplibre/maplibre-react-native";

import { CharacterMarker } from "./CharacterMarker";
import { useEvents } from "../EventsProvider";
import { placeOfPerson } from "../lifespan";
import type { Character } from "../types";

export type CharacterMarkersProps = {
  /** Opens someone's card. */
  onOpen: (person: Character) => void;
};

/**
 * Everyone alive in the year the reader is looking at.
 *
 * Unlike the events, which are capped at three so the plate is not paved with
 * photographs, every living person is drawn. The cap exists because a
 * collection holds thousands of events and only ever reads one; the people
 * alive in any one year are a handful, and leaving one out would be leaving
 * out the answer to "who was around then" — which is the whole question this
 * layer is here to answer.
 */
export function CharacterMarkers({ onOpen }: CharacterMarkersProps) {
  const { visibleCharacters } = useEvents();

  return (
    <>
      {visibleCharacters.map((person) => {
        const at = placeOfPerson(person);
        // Never null in this list — `standsAt` has already refused the
        // unplaced — but the compiler is right to ask.
        if (at === null) return null;
        return (
          <Marker
            key={person.id}
            lngLat={[at.longitude, at.latitude]}>
            <CharacterMarker person={person} onPress={() => onOpen(person)} />
          </Marker>
        );
      })}
    </>
  );
}
