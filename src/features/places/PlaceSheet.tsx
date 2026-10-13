import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { useMyPlaces } from "./MyPlacesProvider";
import type { TouchedPlace } from "./PlaceLayers";
import { Dialog, InkButton, useNotice } from "../../components/ui";
import { whyLocked } from "../community/copies";
import { ShareRow } from "../community/ShareRow";
import { stake } from "../community/stakes";
import { formatYear } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { type } from "../../theme/tokens";

export type PlaceSheetProps = {
  place: TouchedPlace | null;
  onClose: () => void;
};

/** Les années d'une ville posée par le lecteur, dites comme il les a dites. */
function span(from: number, to: number | null): string {
  if (to === null) return `Fondée en ${formatYear(from)}.`;
  if (to === from) return `En ${formatYear(from)}.`;
  return `De ${formatYear(from)} à ${formatYear(to)}.`;
}

/**
 * Une ville que le doigt a trouvée, et la seule chose qu'on en puisse faire.
 *
 * Laquelle dépend d'où elle vient, et la différence est réelle :
 *
 * - **Elle venait avec la carte.** `places` est un jeu de référence, partagé
 *   par tous les comptes et rechargeable depuis OpenHistoricalMap ; personne
 *   n'y supprime rien. Elle est masquée pour ce lecteur, à toutes les
 *   époques, et peut revenir.
 * - **Le lecteur l'a posée.** Elle est à lui, elle n'existe nulle part
 *   ailleurs, et l'ôter l'ôte. Rien à masquer, rien à rétablir : la fiche le
 *   dit plutôt que de promettre autre chose.
 *
 * Même fiche que `TerritorySheet`, au mot près là où le geste est le même.
 */
export function PlaceSheet({ place, onClose }: PlaceSheetProps) {
  const { mine, erase, share, mask } = useMyPlaces();
  const [busy, setBusy] = useState(false);
  const { say, dialog } = useNotice();

  const own = place?.drawn === true;
  /** Sa ligne à nous, qui porte ses années et son partage. */
  const ours = own ? (mine.find((one) => one.id === place?.id) ?? null) : null;

  return (
    <Dialog
      visible={place !== null}
      onClose={onClose}
      title={place?.name ?? ""}
      hint={
        place === null
          ? undefined
          : ours
            ? `${span(ours.from, ours.to)} Vous l'avez posée.`
            : place.kind === "town"
              ? "Un bourg, venu avec la carte."
              : "Une ville, venue avec la carte."
      }
      /* La croix du coin est la sortie ; un « Fermer » sous l'unique vrai
         choix ne dirait que la même chose deux fois. */
      dismissLabel={null}
    >
      {dialog}

      <Text style={styles.line}>
        {own
          ? stake(
              ours?.origin ?? null,
              "La supprimer est définitif : elle n'existe que sur votre carte.",
            )
          : "La retirer ne l'efface pas : elle disparaît de votre carte, à toutes les époques, et vous pourrez la rétablir depuis le bouton territoires."}
      </Text>

      {/* Seulement ce que le lecteur a posé : le jeu de référence appartient
          déjà à tout le monde, et rien de lui n'est à nous pour le partager
          ou le retenir. */}
      {own && ours ? (
        <ShareRow
          what="cette ville"
          shared={ours.shared}
          locked={whyLocked(ours.origin)}
          onChange={(next) => share(ours.id, next)}
        />
      ) : null}

      <InkButton
        label={
          busy ? "…" : own ? "Supprimer définitivement" : "Retirer de ma carte"
        }
        variant="solid"
        tone="danger"
        disabled={busy || place === null}
        onPress={() => {
          if (!place) return;
          // Une ville de référence est masquée par son `ohm_id`, la seule clé
          // qui survive à un rechargement de l'extrait ; une ville à nous est
          // supprimée par la sienne. L'une ou l'autre est forcément là.
          const deed = own
            ? place.id === null
              ? null
              : erase(place.id)
            : place.ohm === null
              ? null
              : mask(place.ohm);
          if (deed === null) {
            onClose();
            return;
          }
          setBusy(true);
          void deed
            .then(onClose)
            .catch((cause: unknown) =>
              say(
                own ? "Suppression impossible" : "Impossible de la retirer",
                cause instanceof Error ? cause.message : String(cause),
              ),
            )
            .finally(() => setBusy(false));
        }}
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  line: { ...type.caption, color: palette.inkSoft },
});
