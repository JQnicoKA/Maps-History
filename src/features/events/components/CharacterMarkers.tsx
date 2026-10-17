import { Marker } from "@maplibre/maplibre-react-native";

import { CharacterMarker } from "./CharacterMarker";
import { useEvents } from "../EventsProvider";
import { placeOfPerson } from "../lifespan";
/**
 * Everyone alive in the year the reader is looking at.
 *
 * Unlike the events, which are capped at three so the plate is not paved with
 * photographs, every living person is drawn. The cap exists because a
 * collection holds thousands of events and only ever reads one; the people
 * alive in any one year are a handful, and leaving one out would be leaving
 * out the answer to "who was around then" — which is the whole question this
 * layer is here to answer.
 *
 * **Une touche sélectionne, elle n'ouvre pas** — et c'est maintenant le même
 * geste que sur un événement. Elle levait la fiche du personnage d'emblée,
 * là où un marqueur d'événement pose d'abord sa tuile au pied de la planche
 * et laisse la fiche à une seconde touche. Deux marqueurs voisins qui ne
 * répondent pas pareil au même doigt, c'est une grammaire à apprendre deux
 * fois ; et la première touche est souvent une question — *qui est-ce ?* —
 * à laquelle la tuile répond sans couvrir la carte.
 *
 * `selectEvent` prend l'un comme l'autre : un identifiant est un
 * identifiant, et la frise s'arrête déjà sur les deux.
 */
export function CharacterMarkers() {
  const { visibleCharacters, selectEvent } = useEvents();

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
            <CharacterMarker
              person={person}
              onPress={() => selectEvent(person.id)}
            />
          </Marker>
        );
      })}
    </>
  );
}
