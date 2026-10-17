import { useMemo } from "react";

import { CollectionPage } from "./CollectionPage";
import { CharacterSummaryCard } from "../../features/events/components/CharacterSummaryCard";
import { useEvents } from "../../features/events/EventsProvider";
import { momentOf } from "../../features/events/lifespan";
import type { Character } from "../../features/events/types";

export type CharactersScreenProps = {
  /** Demande la fiche de quelqu'un. */
  onOpen: (id: string) => void;
  /** Demande le formulaire, vierge. */
  onCreate: () => void;
  /** Demande le catalogue de la bibliothèque, côté personnages. */
  onSeek: () => void;
};

/**
 * Les personnages de la collection, par ordre de naissance.
 *
 * Le même axe que les événements, donc les deux pages se lisent de la même
 * main — et c'est l'axe sur lequel toute l'application est bâtie. Les
 * personnes sans date remontent en tête : `momentOf` leur donne `-Infinity`,
 * et c'est la règle de `compareByLife`, qui veut qu'un non daté soit en vue
 * plutôt qu'enterré au bout d'une liste.
 *
 * Comme la page des événements, elle ignore les filtres : ils appartiennent
 * à la carte.
 */
export function CharactersScreen({
  onOpen,
  onCreate,
  onSeek,
}: CharactersScreenProps) {
  const { characters } = useEvents();

  const ordered = useMemo<Character[]>(
    () => [...characters].sort((a, b) => momentOf(a) - momentOf(b)),
    [characters],
  );

  return (
    <CollectionPage
      title="Personnages"
      count={
        characters.length === 0
          ? "Aucun personnage"
          : `${characters.length} personnage${characters.length > 1 ? "s" : ""}`
      }
      seekLabel="Rechercher un personnage"
      onSeek={onSeek}
      addLabel="Créer un personnage"
      onAdd={onCreate}
      data={ordered}
      keyOf={(one) => one.id}
      row={(one) => (
        <CharacterSummaryCard person={one} onOpen={() => onOpen(one.id)} />
      )}
      empty="Aucun personnage pour l'instant. Écrivez-en un, ou cherchez-en un dans la bibliothèque."
    />
  );
}
