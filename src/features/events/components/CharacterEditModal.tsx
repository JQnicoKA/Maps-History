import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { EventDateField, LIFE_LABELS } from "./EventDateField";
import { PhotoPicker } from "./PhotoPicker";
import { InkButton, InkField, Sheet } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
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
  target,
  onClose,
}: CharacterEditModalProps) {
  const { characters, events, addCharacter, editCharacter, removeCharacter } =
    useEvents();

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
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<StoredPhoto[]>(
    person?.photos ?? [],
  );
  const [droppedPhotos, setDroppedPhotos] = useState<StoredPhoto[]>([]);
  const [saving, setSaving] = useState(false);

  if (target === null) return null;

  const appears = person
    ? events.filter((event) => event.characters.includes(person.id)).length
    : 0;

  const confirmDelete = () => {
    if (!person) return;
    Alert.alert(
      `Supprimer « ${person.name} » ?`,
      appears === 0
        ? "Aucun événement ne le mentionne."
        : `${appears} événement${appears > 1 ? "s" : ""} le mentionne${appears > 1 ? "nt" : ""}. ` +
          `${appears > 1 ? "Ils ne seront pas supprimés" : "Il ne sera pas supprimé"}, seulement délié${appears > 1 ? "s" : ""}.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            setSaving(true);
            void removeCharacter(person)
              .then(onClose)
              .catch((cause: unknown) =>
                Alert.alert(
                  "Suppression impossible",
                  cause instanceof Error ? cause.message : String(cause),
                ),
              )
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  };

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed === "") {
      Alert.alert("Nom manquant", "Un personnage a besoin d'un nom.");
      return;
    }
    if (
      characters.some(
        (other) =>
          other.id !== person?.id &&
          other.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      Alert.alert("Personnage existant", `« ${trimmed} » est déjà dans la liste.`);
      return;
    }

    const draft = { name: trimmed, bio, birth, death, photos };

    setSaving(true);
    try {
      if (person) {
        await editCharacter(person.id, draft, keptPhotos, droppedPhotos);
      } else {
        await addCharacter(draft);
      }
      onClose();
    } catch (cause) {
      Alert.alert(
        "Enregistrement impossible",
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={creating ? "Nouveau personnage" : "Modifier le personnage"}
      footer={
        <>
          {person ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Supprimer ce personnage"
              disabled={saving}
              onPress={confirmDelete}
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
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
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
