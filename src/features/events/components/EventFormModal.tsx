import { useState, type ReactNode } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { FolderManager } from "./FolderManager";
import { FolderSelector } from "./FolderSelector";
import { EventDateField } from "./EventDateField";
import { PhotoPicker } from "./PhotoPicker";
import { TypePicker, typeName } from "./TypePicker";
import {
  InkButton,
  InkField,
  SegmentedControl,
  Sheet,
} from "../../../components/ui";
import { radius, space, type } from "../../../theme/tokens";
import { useEvents } from "../EventsProvider";

import {
  type EventDraft,
  type EventFolderLink,
  type EventPhoto,
  type EventType,
  type HistoricalDate,
  type HistoricalEvent,
  type PickedPhoto,
} from "../types";
import { palette } from "../../../theme/palette";

/**
 * A heading and, optionally, the current answer beside it.
 *
 * The form used to be a single column of identical grey slabs with a small
 * label over each — nothing told the eye where one question ended and the next
 * began. Four headings turn it into four short questions.
 */
function Section({
  title,
  answer,
  children,
}: {
  title: string;
  answer?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {answer ? <Text style={styles.sectionAnswer}>{answer}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export type EventFormModalProps = {
  visible: boolean;
  /**
   * The event being edited, if any. The parent gives this modal a `key` tied to
   * it, so switching events remounts the form and the state below re-seeds.
   */
  event?: HistoricalEvent | null;
  location: { longitude: number; latitude: number } | null;
  onRequestPlacement: () => void;
  onCancel: () => void;
  onSaved: () => void;
};

export function EventFormModal({
  visible,
  event,
  location,
  onRequestPlacement,
  onCancel,
  onSaved,
}: EventFormModalProps) {
  const { folders, addEvent, editEvent } = useEvents();

  /**
   * Which half of the Add sheet is showing. Editing an existing event has no
   * second half — there is nothing to add but the changes in front of you.
   */
  const [tab, setTab] = useState<"event" | "folder">("event");

  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? "other");
  const [description, setDescription] = useState(event?.description ?? "");
  const [start, setStart] = useState<HistoricalDate | null>(
    event?.start ?? null,
  );
  const [end, setEnd] = useState<HistoricalDate | null>(event?.end ?? null);
  const [links, setLinks] = useState<EventFolderLink[]>(event?.folders ?? []);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<EventPhoto[]>(
    event?.photos ?? [],
  );
  const [droppedPhotos, setDroppedPhotos] = useState<EventPhoto[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTab("event");
    setTitle("");
    setType("other");
    setDescription("");
    setStart(null);
    setEnd(null);
    setLinks([]);
    setPhotos([]);
    setKeptPhotos([]);
    setDroppedPhotos([]);
  };

  const save = async () => {
    if (title.trim() === "") {
      Alert.alert("Titre manquant", "Un événement a besoin d'un titre.");
      return;
    }
    if (!location) {
      Alert.alert("Lieu manquant", "Placez l'événement sur la carte.");
      return;
    }

    if (!start) {
      Alert.alert("Date manquante", "Choisissez au moins une année.");
      return;
    }

    const draft: EventDraft = {
      title,
      type,
      description,
      start,
      end,
      longitude: location.longitude,
      latitude: location.latitude,
      folders: links,
      photos,
    };

    setSaving(true);
    try {
      if (event) {
        await editEvent(event.id, draft, keptPhotos, droppedPhotos);
      } else {
        await addEvent(draft);
        reset();
      }
      onSaved();
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
      visible={visible}
      onClose={onCancel}
      title={event ? "Modifier l'événement" : "Ajouter"}
      footer={
        // A folder is written the moment it is named, so that half of the
        // sheet has nothing to save and nothing to cancel.
        tab === "folder" ? (
          <InkButton
            label="Fermer"
            variant="tonal"
            grow
            onPress={() => {
              reset();
              onCancel();
            }}
          />
        ) : (
          <>
            <InkButton
              label="Annuler"
              variant="tonal"
              grow
              onPress={() => {
                reset();
                onCancel();
              }}
            />
            <InkButton
              label={saving ? "Enregistrement…" : "Enregistrer"}
              variant="solid"
              grow
              disabled={saving}
              onPress={() => void save()}
            />
          </>
        )
      }
    >
      {event ? null : (
        <View style={styles.switcher}>
          <SegmentedControl
            segments={[
              { value: "event" as const, label: "Nouvel événement" },
              { value: "folder" as const, label: "Nouveau classeur" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
      )}

      {tab === "folder" && !event ? <FolderManager /> : null}

      <ScrollView
        style={tab === "folder" && !event ? styles.hidden : null}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Section title="Ce qui s'est passé" answer={typeName(type)}>
          <InkField
            label="Titre"
            value={title}
            onChangeText={setTitle}
            placeholder="Prise de Constantinople"
          />
          <TypePicker value={type} onChange={setType} />
          <InkField
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Ce que l'on en retient…"
          />
        </Section>

        <Section title="Quand">
          {/* One control, and the question of whether it lasted is asked
              inside it — where the answer is given. */}
          <EventDateField
            start={start}
            end={end}
            onChange={(nextStart, nextEnd) => {
              setStart(nextStart);
              setEnd(nextEnd);
            }}
          />
        </Section>

        <Section title="Où">
          <View style={styles.location}>
            <View style={styles.locationText}>
              <Text style={styles.legend}>Lieu</Text>
              <Text style={styles.coordinates}>
                {location
                  ? `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`
                  : "Non défini"}
              </Text>
            </View>
            <InkButton
              label={location ? "Déplacer" : "Placer"}
              variant={location ? "tonal" : "solid"}
              onPress={onRequestPlacement}
            />
          </View>
        </Section>

        <Section
          title="Classement"
          answer={
            links.length === 0
              ? undefined
              : `${links.length} classeur${links.length > 1 ? "s" : ""}`
          }
        >
          <FolderSelector folders={folders} value={links} onChange={setLinks} />
        </Section>

        <Section title="Images">
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
        </Section>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  switcher: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
  },
  hidden: { display: "none" },
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xxl,
  },
  section: { gap: space.md },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.sm,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: palette.ink },
  sectionAnswer: { ...type.caption, color: palette.wax, fontWeight: "600" },
  location: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  locationText: { flex: 1, gap: space.xs },
  legend: { ...type.legend, color: palette.inkSoft },
  coordinates: { fontSize: 15, color: palette.ink, fontWeight: "500" },
});
