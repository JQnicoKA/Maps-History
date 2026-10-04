import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { EventDateField, LIFE_LABELS } from "./EventDateField";
import { PhotoPicker } from "./PhotoPicker";
import {
  ConfirmDialog,
  InkButton,
  InkField,
  Sheet,
  useLingering,
  useNotice,
} from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { usePlacement } from "../../placement";
import { LikelyDuplicates } from "../../community/LikelyDuplicates";
import { CHARACTER_LOOK } from "../../community/looks";
import type { Point } from "../../placement";
import type {
  Character,
  HistoricalDate,
  PickedPhoto,
  StoredPhoto,
} from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, TOUCH, type } from "../../../theme/tokens";

const TRASH = require("../../../../assets/icons/trash.png");

export type CharacterEditModalProps = {
  /** Someone to edit, `"new"` to invent one, `null` to stay shut. */
  target: Character | "new" | null;
  onClose: () => void;
  /**
   * Fired once the panel is off the screen — see `Sheet`. Whoever opened this
   * card by closing another one uses it to bring that one back.
   */
  onClosed?: () => void;
};

/**
 * Someone's card: a name, a face or several, the dates that bound a life, and
 * a few lines about them.
 *
 * The dates are the very control an event uses for its own two — a birth and a
 * death are a start and an end, and asking the same question twice with two
 * different pickers would be a way of pretending they are different questions.
 * Only the wording changes.
 */
export function CharacterEditModal({
  target: subject,
  onClose,
  onClosed,
}: CharacterEditModalProps) {
  const {
    characters,
    events,
    addCharacter,
    editCharacter,
    removeCharacter,
    refresh,
  } = useEvents();
  const { aiming, place } = usePlacement();

  // Kept while the panel leaves, so it does not vanish mid-slide and so the
  // screen is told when it has gone. Fields are re-seeded by the remount the
  // caller's key forces on the way *in*, never by this.
  const target = useLingering(subject);

  const creating = target === "new";
  const person = creating ? null : target;

  const [name, setName] = useState(person?.name ?? "");
  const [bio, setBio] = useState(person?.bio ?? "");
  const [birth, setBirth] = useState<HistoricalDate | null>(
    person?.birth ?? null,
  );
  const [death, setDeath] = useState<HistoricalDate | null>(
    person?.death ?? null,
  );
  const [where, setWhere] = useState<Point | null>(
    person?.longitude != null && person.latitude != null
      ? { longitude: person.longitude, latitude: person.latitude }
      : null,
  );
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<StoredPhoto[]>(
    person?.photos ?? [],
  );
  const [droppedPhotos, setDroppedPhotos] = useState<StoredPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  /** The confirmation standing between the trash button and the deed. */
  const [asking, setAsking] = useState(false);
  const { say, dialog } = useNotice();

  if (target === null) return null;

  const appears = person
    ? events.filter((event) => event.characters.includes(person.id)).length
    : 0;

  /** What the reader stands to lose, said plainly before they decide. */
  const kept =
    person?.origin === null || person === null
      ? ""
      : " Et vous n'effacez que votre copie : celle de son auteur, dans la communauté, n'est pas touchée.";

  const stake =
    appears === 0
      ? "Aucun événement ne le mentionne."
      : `${appears} événement${appears > 1 ? "s" : ""} le mentionne${appears > 1 ? "nt" : ""}. ` +
        `${appears > 1 ? "Ils ne seront pas supprimés" : "Il ne sera pas supprimé"}, seulement délié${appears > 1 ? "s" : ""}.`;

  const warning = stake + kept;

  const erase = () => {
    if (!person) return;
    setAsking(false);
    setSaving(true);
    void removeCharacter(person)
      .then(onClose)
      .catch((cause: unknown) =>
        say(
          "Suppression impossible",
          cause instanceof Error ? cause.message : String(cause),
        ),
      )
      .finally(() => setSaving(false));
  };

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed === "") {
      say("Nom manquant", "Un personnage a besoin d'un nom.");
      return;
    }
    if (
      characters.some(
        (other) =>
          other.id !== person?.id &&
          other.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      say("Personnage existant", `« ${trimmed} » est déjà dans la liste.`);
      return;
    }

    // A person is drawn on the map from their birth onward, at one point.
    // Neither can be guessed, so neither is optional — a death can be: not
    // having written one down is not the same as claiming immortality.
    if (!birth) {
      say(
        "Naissance manquante",
        "Ajoutez une date de naissance, même incertaine.",
      );
      return;
    }
    if (!where) {
      say("Lieu manquant", "Placez le personnage sur la carte.");
      return;
    }

    const draft = {
      name: trimmed,
      bio,
      birth,
      death,
      longitude: where.longitude,
      latitude: where.latitude,
      photos,
    };

    setSaving(true);
    try {
      if (person) {
        await editCharacter(person.id, draft, keptPhotos, droppedPhotos);
      } else {
        await addCharacter(draft);
      }
      onClose();
    } catch (cause) {
      say(
        "Enregistrement impossible",
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      // Out of the way while the reader is aiming at the map, and back
      // afterwards with everything they had typed still in its fields: the
      // state lives here, not in the panel.
      visible={subject !== null && !aiming}
      // The foot of the panel stays where it is; the list below makes room
      // for the keys instead — see `Sheet`.
      liftsForKeyboard={false}
      onClose={onClose}
      // Only when the card is really finished, never when it merely stepped
      // aside for the reticle.
      onClosed={aiming ? undefined : onClosed}
      title={creating ? "Nouveau personnage" : "Modifier le personnage"}
      footer={
        <>
          {person ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Supprimer ce personnage"
              disabled={saving}
              onPress={() => setAsking(true)}
              style={({ pressed }) => [
                styles.trash,
                (pressed || saving) && styles.pressed,
              ]}
            >
              <Image source={TRASH} style={styles.trashGlyph} resizeMode="contain" />
            </Pressable>
          ) : null}
          <InkButton label="Annuler" variant="tonal" grow onPress={onClose} />
          <InkButton
            label={saving ? "Enregistrement…" : "Enregistrer"}
            variant="solid"
            grow
            disabled={saving}
            onPress={() => void save()}
          />
        </>
      }
    >
      {dialog}

      <ConfirmDialog
        visible={asking}
        title={`Supprimer « ${person?.name ?? ""} » ?`}
        message={warning}
        confirmLabel="Supprimer"
        onConfirm={erase}
        onClose={() => setAsking(false)}
      />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <InkField
          label="Nom"
          value={name}
          onChangeText={setName}
          placeholder="Napoléon Bonaparte"
        />

        <EventDateField
          start={birth}
          end={death}
          labels={LIFE_LABELS}
          onChange={(nextBirth, nextDeath) => {
            setBirth(nextBirth);
            setDeath(nextDeath);
          }}
        />

        {/* After the dates and before the rest, for the reason measured in
            `characters_like`: a name alone cannot tell two Merovingian kings
            apart, and a birth year can. */}
        {creating ? (
          <LikelyDuplicates
            kind="character"
            look={CHARACTER_LOOK}
            noun="personnage"
            title={name}
            year={birth?.year ?? null}
            approximate={birth?.approximate === true}
            onTaken={() => {
              // The collection reloads itself inside `addCharacter`'s
              // sibling; here the card simply closes on a person who is now
              // in the list behind it.
              void refresh().then(onClose);
            }}
          />
        ) : null}

        <View style={styles.section}>
          <Text style={styles.legend}>Où</Text>
          <View style={styles.location}>
            <Text style={styles.coordinates}>
              {where
                ? `${where.latitude.toFixed(4)}°, ${where.longitude.toFixed(4)}°`
                : "Non défini"}
            </Text>
            <InkButton
              label={where ? "Déplacer" : "Placer"}
              variant={where ? "tonal" : "solid"}
              onPress={() => {
                void place().then((point) => {
                  // Null means they backed out, which must not erase a point
                  // they had already chosen.
                  if (point) setWhere(point);
                });
              }}
            />
          </View>
        </View>

        <InkField
          label="À son sujet"
          value={bio}
          onChangeText={setBio}
          multiline
          placeholder="Quelques lignes…"
        />

        <View style={styles.section}>
          <Text style={styles.legend}>Portraits</Text>
          <PhotoPicker
            photos={photos}
            onChange={setPhotos}
            existing={keptPhotos}
            onChangeExisting={setKeptPhotos}
            onRemoveExisting={(photo) => {
              setKeptPhotos((current) =>
                current.filter((kept) => kept.id !== photo.id),
              );
              setDroppedPhotos((current) => [...current, photo]);
            }}
          />
        </View>

        {person && appears > 0 ? (
          <Text style={styles.appears}>
            {appears} événement{appears > 1 ? "s" : ""} le mentionne
            {appears > 1 ? "nt" : ""}.
          </Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  section: { gap: space.sm },
  legend: { ...type.legend, color: palette.inkSoft },
  location: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  coordinates: { ...type.body, flexShrink: 1, color: palette.ink },
  hint: { ...type.legend, color: palette.inkFaint },
  appears: { ...type.caption, color: palette.inkFaint },
  pressed: { opacity: 0.5 },
  trash: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  trashGlyph: { width: 20, height: 20 },
});
