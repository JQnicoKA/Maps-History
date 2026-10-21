import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PhotoViewer } from "./PhotoViewer";
import { SharePill } from "../../community/SharePill";
import { COPY_IS_A_COPY } from "../../community/stakes";
import {
  Chip,
  ConfirmDialog,
  InkButton,
  Sheet,
  useLingering,
  useNotice,
} from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { formatEventPeriod } from "../historicalDate";
import { lifespan, placeOfPerson } from "../lifespan";
import { type Character, type StoredPhoto } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, TOUCH, type } from "../../../theme/tokens";

const TRASH = require("../../../../assets/icons/trash.png");

export type CharacterDetailModalProps = {
  person: Character | null;
  onEdit: (person: Character) => void;
  /**
   * La fiche sans ses actions : on la lit, on ne la travaille pas.
   *
   * Pour le seul endroit qui montre une fiche sans qu'on y soit venu pour
   * elle — le catalogue, quand il prévient qu'on a déjà quelque chose de
   * semblable et qu'on demande à le voir. Y laisser la poubelle et le
   * crayon offrirait de supprimer son personnage au milieu d'une décision qui
   * ne portait que sur une copie.
   *
   * Seul « Fermer » reste, et la feuille se referme d'un glissement vers le
   * bas comme toutes les autres : on revient donc à la question.
   */
  readOnly?: boolean;

  /** Opens one of the events this person appears in. */
  onOpenEvent: (id: string) => void;
  /** Opens one of the trees they stand in. */
  onOpenTree: (id: string) => void;
  /**
   * A tree to leave out of the list — the one this card was opened from.
   *
   * Offering the drawing the reader is standing in as somewhere to go would
   * mean closing it to open it again.
   */
  exceptTree?: string;
  onClose: () => void;
  /** Fired once the panel is off the screen — see `Sheet`. */
  onClosed?: () => void;
};

/**
 * Someone's page, read rather than filled in.
 *
 * The twin of the event sheet, down to the three things at the foot of it: a
 * trash can, "Modifier", "Fermer". Tapping a cameo on the map used to open the
 * form — every field editable, a keyboard one tap away — when all the reader
 * had asked was *who is this*. The two questions have two panels now, and the
 * pencil in the list is what says which one you get.
 *
 * Nothing is fetched. A character is held whole in the collection, portraits
 * included, so unlike the event sheet there is nothing to wait for and no
 * half-drawn state to guard against.
 */
export function CharacterDetailModal({
  person: subject,
  onEdit,
  readOnly = false,
  onOpenEvent,
  onOpenTree,
  exceptTree,
  onClose,
  onClosed,
}: CharacterDetailModalProps) {
  // Drawn from whoever was last really here, so the panel still has a face on
  // it while it slides away — and so `onClosed` gets a chance to fire.
  const person = useLingering(subject);
  const { events, trees, removeCharacter } = useEvents();
  const [deleting, setDeleting] = useState(false);
  /** The confirmation standing between the trash button and the deed. */
  const [asking, setAsking] = useState(false);
  const [viewing, setViewing] = useState<StoredPhoto | null>(null);
  const { say, dialog } = useNotice();

  if (!person) return null;

  const face = person.photos[0];
  const at = placeOfPerson(person);
  const life = lifespan(person);

  const appears = events.filter((event) =>
    event.characters.includes(person.id),
  );
  /** Every tree they stand in — what a deletion would take them out of. */
  const rooted = trees.filter((tree) =>
    tree.members.some(
      (member) => member.kind === "person" && member.characterId === person.id,
    ),
  );
  /** And the ones worth offering as somewhere to go from here. */
  const standsIn = rooted.filter((tree) => tree.id !== exceptTree);

  /**
   * What the reader stands to lose, said plainly before they decide.
   *
   * The trees are named as well as the events, because this card is reached
   * from inside a tree: there, "Supprimer" means the person and everything
   * they hold, while taking them out of that one drawing is what the hold
   * menu offers.
   */
  const stake = [
    appears.length === 0
      ? "Aucun événement ne le mentionne."
      : `${appears.length} événement${appears.length > 1 ? "s" : ""} le mentionne${appears.length > 1 ? "nt" : ""}, ` +
        `et ${appears.length > 1 ? "ils resteront" : "il restera"} — seulement délié${appears.length > 1 ? "s" : ""}.`,
    rooted.length === 0
      ? null
      : `Il quittera ${rooted.length === 1 ? "l'arbre" : `les ${rooted.length} arbres`} où il se tient.`,
    person.origin === null ? null : COPY_IS_A_COPY,
  ]
    .filter(Boolean)
    .join(" ");

  const erase = async () => {
    setAsking(false);
    setDeleting(true);
    try {
      await removeCharacter(person);
      onClose();
    } catch (cause) {
      say(
        "Suppression impossible",
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Sheet
      visible={subject !== null}
      onClose={onClose}
      onClosed={onClosed}
      footer={
        readOnly ? (
          <InkButton label="Fermer" variant="solid" grow onPress={onClose} />
        ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Supprimer ce personnage"
            disabled={deleting}
            onPress={() => setAsking(true)}
            style={({ pressed }) => [
              styles.trash,
              (pressed || deleting) && styles.trashPressed,
            ]}
          >
            <Image source={TRASH} style={styles.trashGlyph} resizeMode="contain" />
          </Pressable>
          <InkButton
            label="Modifier"
            variant="tonal"
            grow
            onPress={() => onEdit(person)}
          />
          <InkButton label="Fermer" variant="solid" grow onPress={onClose} />
        </>
        )
      }
    >
      {dialog}

      <ConfirmDialog
        visible={asking}
        title={`Supprimer « ${person.name} » ?`}
        message={stake}
        confirmLabel="Supprimer"
        onConfirm={() => void erase()}
        onClose={() => setAsking(false)}
      />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.header}>
          {/* The portrait leads, where the event sheet leads with its type:
              a face is what one recognises a person by. */}
          <View style={styles.portrait}>
            {face ? (
              <Image source={{ uri: face.url }} style={styles.portraitImage} />
            ) : (
              <Text style={styles.initial}>
                {person.name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.headText}>
            {life === "" ? null : <Text style={styles.life}>{life}</Text>}
            <Text style={styles.name}>{person.name}</Text>

            {/* Là où s'affichaient les coordonnées, qui ne disaient rien à
                personne : deux nombres à deux décimales ne se lisent pas, et
                la carte les montre mieux que n'importe quel texte. Qui peut
                lire cette fiche, en revanche, se lit d'un coup d'œil. Le
                changement, lui, vit dans « Modifier le personnage ». */}
            <SharePill shared={person.shared} small />

            {/* Gardé, parce que ce n'est pas la même information : absent de
                la carte est un manque à combler, pas une donnée. */}
            {at === null ? (
              <Text style={styles.place}>
                Pas encore placé : absent de la carte.
              </Text>
            ) : null}
          </View>
        </View>

        {person.bio ? <Text style={styles.bio}>{person.bio}</Text> : null}

        {/* Every portrait, not just the first: the head of the sheet shows one
            and the rest would otherwise exist only inside the form. */}
        {person.photos.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.photos}>
              {person.photos.map((photo) => (
                <Pressable
                  key={photo.id}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="Agrandir le portrait"
                  onPress={() => setViewing(photo)}
                  style={({ pressed }) => (pressed ? styles.dim : undefined)}
                >
                  <Image source={{ uri: photo.url }} style={styles.photo} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : null}

        {/* Le classement, avant ce qu'il a fait : il dit sous quel sujet son
            auteur le range, et c'est une lecture du personnage lui-même. */}
        <View style={styles.section}>
          <Text style={styles.legend}>Classement</Text>
          {person.folders.length === 0 ? (
            <Text style={styles.none}>Rangé nulle part</Text>
          ) : (
            <View style={styles.chips}>
              {/* Les mêmes pastilles que le formulaire, sans le geste : il n'y
                  a rien à cocher sur la fiche de ce qu'on lit. */}
              {person.folders.map((name) => (
                <Chip key={name} label={name} selected tone="wax" />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.legend}>Événements</Text>
          {appears.length === 0 ? (
            <Text style={styles.none}>Aucun événement ne le mentionne.</Text>
          ) : (
            appears.map((event) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={event.title}
                onPress={() => onOpenEvent(event.id)}
                style={({ pressed }) => [styles.row, pressed && styles.dim]}
              >
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={styles.rowDetail}>{formatEventPeriod(event)}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))
          )}
        </View>

        {/* Only when there are any: a heading over "aucun arbre" would make a
            genealogy sound like something every person is missing. */}
        {standsIn.length === 0 ? null : (
          <View style={styles.section}>
            <Text style={styles.legend}>Arbres</Text>
            {standsIn.map((tree) => (
              <Pressable
                key={tree.id}
                accessibilityRole="button"
                accessibilityLabel={tree.name}
                onPress={() => onOpenTree(tree.id)}
                style={({ pressed }) => [styles.row, pressed && styles.dim]}
              >
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {tree.name}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />
    </Sheet>
  );
}

const PORTRAIT = 84;

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.lg,
  },
  header: { flexDirection: "row", alignItems: "center", gap: space.lg },
  portrait: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: PORTRAIT / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.sunken,
    borderWidth: 3,
    borderColor: palette.surfaceRaised,
    shadowColor: palette.ink,
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  portraitImage: { width: "100%", height: "100%" },
  initial: { fontSize: 34, fontWeight: "700", color: palette.inkFaint },
  headText: { flex: 1, gap: 2 },
  life: { fontSize: 14, color: palette.wax, fontWeight: "600" },
  name: { fontSize: 24, lineHeight: 30, color: palette.ink, fontWeight: "700" },
  place: { ...type.caption, color: palette.inkFaint },

  bio: { ...type.body, color: palette.inkSoft },
  section: { gap: space.sm },
  legend: { ...type.legend, color: palette.inkFaint },
  none: { ...type.caption, color: palette.inkFaint },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: palette.sunken,
  },
  rowTitle: { flex: 1, fontSize: 15, color: palette.ink },
  rowDetail: { fontSize: 13, color: palette.inkSoft },
  chevron: { fontSize: 20, lineHeight: 22, color: palette.inkFaint },

  photos: { flexDirection: "row", gap: space.md },
  photo: { width: 120, height: 150, borderRadius: radius.md },
  dim: { opacity: 0.6 },

  /**
   * Le rouge posé sur le papier, et le dessin plein par-dessus.
   *
   * `dangerWash` est écrit dans la palette pour ce rôle — « le fond d'un
   * panneau d'avertissement, là où un rouge plein crierait et un gris ne
   * dirait rien ». Il tombe à la même profondeur que le gris creusé qu'il
   * remplace — 1,29 contre le papier, où le gris valait 1,24 —, donc le
   * bouton ne change ni de poids ni de relief : seulement de nature.
   *
   * Opaque et non translucide : un lavis transparent se poserait autrement
   * sur chaque fond, et la même poubelle n'aurait pas deux fois la même
   * couleur d'un écran à l'autre.
   */
  trash: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: palette.dangerWash,
  },
  trashPressed: { opacity: 0.5 },
  /** 5,1:1 sur son lavis, et à pleine opacité. */
  trashGlyph: { width: 20, height: 20, tintColor: palette.danger },
});
