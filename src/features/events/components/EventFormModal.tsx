import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FolderSelector } from "./FolderSelector";
import { HistoricalDateField } from "./HistoricalDateField";
import { PhotoPicker } from "./PhotoPicker";
import { InkButton, InkField, Paper, SelectField } from "../../../components/ui";
import { useEvents } from "../EventsProvider";

import {
  EVENT_TYPES,
  type EventDraft,
  type EventFolderLink,
  type EventPhoto,
  type EventType,
  type HistoricalDate,
  type HistoricalEvent,
  type PickedPhoto,
} from "../types";
import { palette } from "../../../theme/palette";

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
  const { folders, addFolder, addEvent, editEvent } = useEvents();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? "other");
  const [description, setDescription] = useState(event?.description ?? "");
  const [start, setStart] = useState<HistoricalDate | null>(event?.start ?? null);
  const [isPeriod, setIsPeriod] = useState(event?.end != null);
  const [end, setEnd] = useState<HistoricalDate | null>(event?.end ?? null);
  const [links, setLinks] = useState<EventFolderLink[]>(event?.folders ?? []);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<EventPhoto[]>(event?.photos ?? []);
  const [droppedPhotos, setDroppedPhotos] = useState<EventPhoto[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setType("other");
    setDescription("");
    setStart(null);
    setIsPeriod(false);
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
    if (isPeriod && !end) {
      Alert.alert("Date de fin manquante", "Choisissez la fin de la période.");
      return;
    }

    const draft: EventDraft = {
      title,
      type,
      description,
      start,
      end: isPeriod ? end : null,
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Paper
          style={[
            styles.sheet,
            { marginTop: insets.top + 16, marginBottom: insets.bottom + 16 },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.heading}>
              {event ? "Modifier l'événement" : "Nouvel événement"}
            </Text>

            <InkField
              label="Titre"
              value={title}
              onChangeText={setTitle}
              placeholder="Prise de Constantinople"
            />
            <SelectField
              label="Type"
              title="Type d'événement"
              placeholder="Autre"
              single
              options={EVENT_TYPES.map((entry) => ({
                value: entry.value,
                label: `${entry.emoji}  ${entry.label}`,
              }))}
              selected={[type]}
              onToggle={(value) => setType(value as EventType)}
            />

            <InkField
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Ce que l'on en retient…"
            />

            <HistoricalDateField label="Date" value={start} onChange={setStart} />

            <View style={styles.periodRow}>
              <Text style={styles.periodLabel}>Période (date de fin)</Text>
              <Switch
                value={isPeriod}
                onValueChange={setIsPeriod}
                trackColor={{ true: palette.ink, false: palette.inkFaint }}
              />
            </View>
            {isPeriod ? (
              <HistoricalDateField
                label="Date de fin"
                value={end}
                onChange={setEnd}
              />
            ) : null}

            <FolderSelector
              folders={folders}
              value={links}
              onChange={setLinks}
              onCreate={addFolder}
            />

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

            <View style={styles.locationRow}>
              <View style={styles.locationText}>
                <Text style={styles.label}>Lieu</Text>
                <Text style={styles.coordinates}>
                  {location
                    ? `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`
                    : "Non défini"}
                </Text>
              </View>
              <InkButton
                label={location ? "Déplacer" : "Placer sur la carte"}
                onPress={onRequestPlacement}
              />
            </View>

            <View style={styles.actions}>
              <InkButton
                label="Annuler"
                variant="quiet"
                onPress={() => {
                  reset();
                  onCancel();
                }}
              />
              <InkButton
                label={saving ? "Enregistrement…" : "Enregistrer"}
                variant="solid"
                disabled={saving}
                onPress={() => void save()}
              />
            </View>
          </ScrollView>
        </Paper>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(58, 44, 27, 0.45)",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  sheet: { maxHeight: "100%" },
  body: { padding: 16, gap: 14 },
  heading: {
    fontSize: 17,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: palette.ink,
    textAlign: "center",
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  periodLabel: { fontSize: 12, color: palette.inkSoft },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  locationText: { gap: 4 },
  label: {
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: palette.inkSoft,
  },
  coordinates: { fontSize: 14, color: palette.ink },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});
