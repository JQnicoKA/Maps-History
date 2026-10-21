import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useMyPlaces } from "./MyPlacesProvider";
import {
  ConfirmDialog,
  Roster,
  RosterEmpty,
  RosterLegend,
  RosterRow,
  useLingering,
  useNotice,
} from "../../components/ui";
import { formatYear } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { space } from "../../theme/tokens";

const TRASH = require("../../../assets/icons/trash.png");
/** Remettre une ville, c'est exactement « la remontrer sur la carte ». */
const BACK_ON_MAP = require("../../../assets/icons/view-map.png");

export type PlaceListProps = {
  /** Donne la carte au viseur, pour y poser une ville. */
  onPose: () => void;
};

/** Ses années, dites comme le lecteur les a données. */
function said(from: number, to: number | null): string {
  if (to === null) return `depuis ${formatYear(from)}`;
  if (to === from) return formatYear(from);
  return `${formatYear(from)} – ${formatYear(to)}`;
}

/**
 * L'onglet Villes : ce que le lecteur a posé, et ce qu'il a ôté.
 *
 * Même forme que la liste des territoires à côté — un compte, deux manières
 * d'en ajouter une, les lignes, puis les retirées quand il y en a. Dans son
 * propre dossier parce que tout ce qu'elle touche y est ; le panneau qui la
 * porte ne fait que l'appeler.
 */
export function PlaceList({ onPose }: PlaceListProps) {
  const { mine, masked, erase, unmask } = useMyPlaces();
  const [busy, setBusy] = useState<string | null>(null);
  /** La ville qui attend un « oui » avant d'être effacée. */
  const [asking, setAsking] = useState<{ id: string; name: string } | null>(
    null,
  );
  /**
   * La même, gardée le temps que la carte s'efface.
   *
   * Son nom est dans la phrase, et `asking` retombe à `null` dès qu'on
   * répond — alors que `Dialog` garde la carte montée cent soixante
   * millisecondes pour la faire partir en fondu. Sans cela, on lirait
   * « Si vous supprimez «  » » pendant ce quart de seconde.
   */
  const erasing = useLingering(asking);
  const { say, dialog } = useNotice();

  const work = (key: string, deed: Promise<void>, failed: string) => {
    setBusy(key);
    void deed
      .catch((cause: unknown) =>
        say(failed, cause instanceof Error ? cause.message : String(cause)),
      )
      .finally(() => setBusy(null));
  };

  return (
    <>
      {dialog}

      <ConfirmDialog
        visible={asking !== null}
        /* Le genre dans le titre, le nom dans la phrase — comme pour un
           territoire, dans l'onglet d'à côté. Les deux listes sont la même
           liste à un mot près, et leurs oui/non doivent se lire pareil. */
        title="Effacer la ville ?"
        /* Plus de `stake` : une ville n'est jamais une copie, puisqu'elle
           ne se copie plus. L'enjeu est donc toujours le même, et le dire
           par une fonction qui n'a plus qu'une branche serait du détour. */
        message={`Si vous supprimez « ${erasing?.name ?? ""} », elle disparaît pour de bon : elle n'existe que sur votre carte.`}
        confirmLabel="Effacer"
        cancelLabel="Annuler"
        onConfirm={() => {
          const target = asking;
          setAsking(null);
          if (target) {
            work(target.id, erase(target.id), "Suppression impossible");
          }
        }}
        onClose={() => setAsking(null)}
      />

      <Roster
        owned="Vos villes"
        count={mine.length}
        addLabel="Poser une ville"
        onAdd={onPose}
      >
        {mine.length === 0 ? (
          /* Voir la liste des territoires : une invitation, pas une
             explication. */
          <RosterEmpty>Posez votre première ville.</RosterEmpty>
        ) : (
          mine.map((one) => (
            <RosterRow
              key={one.id}
              thumb={
                <Text style={styles.initial}>
                  {one.name.charAt(0).toUpperCase()}
                </Text>
              }
              title={one.name}
              detail={
                busy === one.id ? "Suppression…" : said(one.from, one.to)
              }
              onEdit={() =>
                setAsking({ id: one.id, name: one.name })
              }
              editLabel={`Effacer ${one.name}`}
              editIcon={TRASH}
            />
          ))
        )}
      </Roster>

      {/* Seulement s'il y a quelque chose à dire. Une demi-page intitulée
          « retirées de votre carte » serait la promesse d'une fonction que le
          lecteur n'a pas utilisée. */}
      {masked.length === 0 ? null : (
        <View style={styles.section}>
          {/* Le même titre que celui de la liste du dessus — voir la liste
              des territoires, qui porte le raisonnement. */}
          <RosterLegend label="Villes retirées" count={masked.length} />
          {masked.map((one) => (
            <RosterRow
              key={one.ohm}
              thumb={
                <Text style={styles.initialFaded}>
                  {(one.name ?? "?").charAt(0).toUpperCase()}
                </Text>
              }
              /* Sans nom quand le lieu a quitté l'extrait depuis : la ligne
                 reste, et rétablir la fera reparaître si le lieu revient. */
              title={one.name ?? "Un lieu que la carte ne connaît plus"}
              detail={
                busy === String(one.ohm) ? "…" : "masquée à toutes les époques"
              }
              onEdit={() =>
                work(
                  String(one.ohm),
                  unmask(one.ohm),
                  "Impossible de la rétablir",
                )
              }
              editLabel={`Rétablir ${one.name ?? "ce lieu"}`}
              editIcon={BACK_ON_MAP}
            />
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  initial: { fontSize: 18, fontWeight: "700", color: palette.inkFaint },
  initialFaded: { fontSize: 18, fontWeight: "700", color: palette.line },
});
