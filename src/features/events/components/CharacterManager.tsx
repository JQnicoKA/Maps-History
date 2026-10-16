import { Image, ScrollView, StyleSheet, Text } from "react-native";

import { Roster, RosterEmpty, RosterRow } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { lifespan, placeOfPerson } from "../lifespan";
import type { Character } from "../types";

export type CharacterManagerProps = {
  /**
   * Asks for someone's page, to be read. Absent where a row has nothing to
   * open — a list standing in a picker, whose rows answer `onPick` instead.
   */
  onRead?: (person: Character) => void;
  /**
   * Asks for the form — on someone, or blank.
   *
   * Absent in a picker, and that takes the empty slot away with it: « Nouveau
   * personnage » at the head of a list one is choosing from is a door out of
   * a half-written event, and the pencil on a row is a second one.
   */
  onEdit?: (target: Character | "new") => void;
  /** Asks for the community's people. Absent where there is nowhere to go. */
  onSeek?: () => void;
  /**
   * Choisir quelqu'un au lieu de le lire — et la liste change de métier.
   *
   * Posée, les rangées rendent la personne au lieu d'ouvrir sa page, et le
   * crayon disparaît : on ne corrige pas quelqu'un au moment de le choisir.
   * Tout le reste — le compte, les deux portes, les lignes — ne bouge pas,
   * et c'est le but : l'arbre offre la même liste que la fenêtre Personnages
   * plutôt qu'une ressemblance entretenue à la main.
   */
  onPick?: (person: Character) => void;
  /**
   * Pourquoi celui-ci ne peut pas être choisi, s'il ne peut pas.
   *
   * Rend une raison à afficher, ou `null`. Grisé et hors d'atteinte plutôt
   * que retiré : une liste qui escamote ce qu'elle refuse laisse chercher un
   * nom qui est pourtant là, et fait croire qu'elle est courte alors qu'elle
   * est filtrée.
   */
  unavailable?: (person: Character) => string | null;
};
import { palette } from "../../../theme/palette";
import { space } from "../../../theme/tokens";

/**
 * The people the collection knows about.
 *
 * Same shape as the trees' half, because it is the same kind of thing: a list,
 * and one sheet behind both the slot at the top and the pencil on a row. Les
 * classeurs avaient cette moitié-là eux aussi, et ils l'ont perdue avec leur
 * ligne : on ne tient pas une liste de noms, on les écrit où ils servent.
 *
 * The card itself is not opened here but asked for. A person now carries a
 * place on the map, and choosing one means handing the whole screen to the
 * reticle — which would tear down this list, and with it a half-typed card
 * nested inside it. Opened from the top of the screen instead, the card
 * outlives the trip to the map.
 */
export function CharacterManager({
  onRead,
  onEdit,
  onSeek,
  onPick,
  unavailable,
}: CharacterManagerProps) {
  const { characters, events } = useEvents();

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      <Roster
        count={
          characters.length === 0
            ? "Aucun personnage"
            : `${characters.length} personnage${characters.length > 1 ? "s" : ""}`
        }
        {...(onEdit === undefined
          ? {}
          : { addLabel: "Nouveau personnage", onAdd: () => onEdit("new") })}
        {...(onSeek === undefined
          ? {}
          : {
              seekLabel: "Chercher dans la bibliothèque",
              seekDetail: "Les personnages de la communauté",
              onSeek,
            })}
      >
        {characters.length === 0 ? (
          <RosterEmpty>
            {/* Sans emplacement vide, la liste n'offre aucune porte : elle
                doit donc dire où l'on en fait un, sinon elle est un
                cul-de-sac. C'est le cas du choix — lier quelqu'un à un
                événement, poser quelqu'un dans un arbre. */}
            {onEdit === undefined
              ? "Aucun personnage à lier. On en écrit un depuis le bouton + de la carte, « Personnage »."
              : "Un personnage est quelqu'un qu'un événement met en scène : on peut en lier plusieurs au même événement, et les relier entre eux dans un arbre."}
          </RosterEmpty>
        ) : (
          characters.map((person) => {
            const appears = events.filter((event) =>
              event.characters.includes(person.id),
            ).length;
            const face = person.photos[0];
            const refused = unavailable?.(person) ?? null;
            return (
              <RosterRow
                key={person.id}
                thumb={
                  face ? (
                    <Image source={{ uri: face.url }} style={styles.image} />
                  ) : (
                    <Text style={styles.initial}>
                      {person.name.charAt(0).toUpperCase()}
                    </Text>
                  )
                }
                title={person.name}
                muted={refused !== null}
                detail={[
                  // La raison du refus passe devant : c'est la seule chose
                  // qu'on veut savoir d'une ligne qu'on ne peut pas prendre.
                  refused,
                  lifespan(person),
                  // Said here rather than left to be discovered: the people
                  // written down before the map knew about them are absent
                  // from it, and nothing else on this row would explain why.
                  placeOfPerson(person) === null || person.birth === null
                    ? "à placer sur la carte"
                    : null,
                  appears === 0
                    ? "jamais cité"
                    : `${appears} événement${appears > 1 ? "s" : ""}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                // The row reads, the pencil corrects — the same division the
                // map makes between a tap on an event and its "Modifier".
                // En mode choix, la rangée rend la personne et le crayon
                // s'efface ; refusée, elle ne rend rien du tout.
                {...(refused !== null
                  ? {}
                  : onPick
                    ? { onPress: () => onPick(person) }
                    : {
                        ...(onRead === undefined
                          ? {}
                          : { onPress: () => onRead(person) }),
                        ...(onEdit === undefined
                          ? {}
                          : {
                              onEdit: () => onEdit(person),
                              editLabel: `Modifier ${person.name}`,
                            }),
                      })}
              />
            );
          })
        )}
      </Roster>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  image: { width: "100%", height: "100%" },
  initial: { fontSize: 18, fontWeight: "700", color: palette.inkFaint },
});
