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
import { PhotoPicker } from "./PhotoPicker";
import { InkButton, InkField, Paper } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import {
  EMPTY_DATE_FIELDS,
  buildHistoricalDate,
  type DateFields,
} from "../historicalDate";
import type { EventDraft, EventFolderLink } from "../types";
import { palette } from "../../../theme/palette";

export type EventFormModalProps = {
  visible: boolean;
  location: { longitude: number; latitude: number } | null;
  onRequestPlacement: () => void;
  onCancel: () => void;
  onSaved: () => void;
};

function DateRow({
  legend,
  fields,
  onChange,
}: {
  legend: string;
  fields: DateFields;
  onChange: (fields: DateFields) => void;
}) {
  return (
    <View style={styles.dateRow}>
      <View style={styles.dateSmall}>
        <InkField
          label="Jour"
          value={fields.day}
          onChangeText={(day) => onChange({ ...fields, day })}
          keyboardType="number-pad"
          placeholder="—"
        />
      </View>
      <View style={styles.dateSmall}>
        <InkField
          label="Mois"
          value={fields.month}
          onChangeText={(month) => onChange({ ...fields, month })}
          keyboardType="number-pad"
          placeholder="—"
        />
      </View>
      <View style={styles.dateYear}>
        <InkField
          label={legend}
          value={fields.year}
          onChangeText={(year) => onChange({ ...fields, year })}
          keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
          placeholder="1453 · -330"
        />
      </View>
    </View>
  );
}

export function EventFormModal({
  visible,
  location,
  onRequestPlacement,
  onCancel,
  onSaved,
}: EventFormModalProps) {
  const { folders, addFolder, addEvent } = useEvents();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState<DateFields>(EMPTY_DATE_FIELDS);
  const [isPeriod, setIsPeriod] = useState(false);
  const [end, setEnd] = useState<DateFields>(EMPTY_DATE_FIELDS);
  const [links, setLinks] = useState<EventFolderLink[]>([]);
  const [photos, setPhotos] = useState<EventDraft["photos"]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setStart(EMPTY_DATE_FIELDS);
    setIsPeriod(false);
    setEnd(EMPTY_DATE_FIELDS);
    setLinks([]);
    setPhotos([]);
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

    const startResult = buildHistoricalDate(start);
    if ("error" in startResult) {
      Alert.alert("Date de début", startResult.error);
      return;
    }

    let endDate: EventDraft["end"] = null;
    if (isPeriod) {
      const endResult = buildHistoricalDate(end);
      if ("error" in endResult) {
        Alert.alert("Date de fin", endResult.error);
        return;
      }
      endDate = endResult.date;
    }

    setSaving(true);
    try {
      await addEvent({
        title,
        description,
        start: startResult.date,
        end: endDate,
        longitude: location.longitude,
        latitude: location.latitude,
        folders: links,
        photos,
      });
      reset();
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
            <Text style={styles.heading}>Nouvel événement</Text>

            <InkField
              label="Titre"
              value={title}
              onChangeText={setTitle}
              placeholder="Prise de Constantinople"
            />
            <InkField
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Ce que l'on en retient…"
            />

            <DateRow legend="Année" fields={start} onChange={setStart} />

            <View style={styles.periodRow}>
              <Text style={styles.periodLabel}>Période (date de fin)</Text>
              <Switch
                value={isPeriod}
                onValueChange={setIsPeriod}
                trackColor={{ true: palette.ink, false: palette.inkFaint }}
              />
            </View>
            {isPeriod ? (
              <DateRow legend="Année de fin" fields={end} onChange={setEnd} />
            ) : null}

            <FolderSelector
              folders={folders}
              value={links}
              onChange={setLinks}
              onCreate={addFolder}
            />

            <PhotoPicker photos={photos} onChange={setPhotos} />

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
  dateRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  dateSmall: { width: 58 },
  dateYear: { flex: 1 },
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
