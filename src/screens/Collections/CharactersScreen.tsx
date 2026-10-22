import { useMemo, useState } from "react";

import { CollectionPage } from "./CollectionPage";
import { CharacterSummaryCard } from "../../features/events/components/CharacterSummaryCard";
import { SiftButton } from "../../features/events/components/SiftButton";
import { useEvents } from "../../features/events/EventsProvider";
import { momentOf } from "../../features/events/lifespan";
import { NO_SIFT, kept, type Sift } from "../../features/events/sift";
import type { Character } from "../../features/events/types";

export type CharactersScreenProps = {
  /** Demande la fiche de quelqu'un. */
  onOpen: (id: string) => void;
  /** Demande le formulaire, vierge. */
  onCreate: () => void;
  /** Demande le catalogue de la bibliothèque, côté personnages. */
  onSeek: () => void;
  /** La porte du compte, au bord du bandeau — voir `CollectionPage`. */
  unread: number;
  onProfile: () => void;
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
 * Comme la page des événements, elle ignore le filtre de la **carte** — il
 * appartient à la planche — et porte le sien, qui ne tamise que cette liste :
 * dans quel classeur, et de quelle importance.
 */
export function CharactersScreen({
  onOpen,
  onCreate,
  onSeek,
  unread,
  onProfile,
}: CharactersScreenProps) {
  const { characters, loading, error, refresh } = useEvents();
  const [sift, setSift] = useState<Sift>(NO_SIFT);

  const ordered = useMemo<Character[]>(
    /* `kept` rend déjà une copie : trier ici ne touche pas à la collection
       du fournisseur, que la carte lit aussi. */
    () => kept(characters, sift).sort((a, b) => momentOf(a) - momentOf(b)),
    [characters, sift],
  );

  return (
    <CollectionPage
      title="Personnages"
      owned="Vos personnages"
      count={ordered.length}
      total={characters.length}
      tools={<SiftButton value={sift} onChange={setSift} />}
      seekLabel="Rechercher un personnage"
      onSeek={onSeek}
      addLabel="Créer un personnage"
      onAdd={onCreate}
      data={ordered}
      keyOf={(one) => one.id}
      row={(one) => (
        <CharacterSummaryCard person={one} onOpen={() => onOpen(one.id)} />
      )}
      empty={
        characters.length === 0
          ? "Aucun personnage pour l'instant. Écrivez-en un, ou cherchez-en un dans la bibliothèque."
          : "Aucun personnage ne répond à ces filtres."
      }
      loading={loading}
      failed={error}
      onRetry={() => void refresh()}
      unread={unread}
      onProfile={onProfile}
    />
  );
}
