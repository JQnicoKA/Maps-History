import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhotoViewer } from "./PhotoViewer";
import { InkButton, Paper } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { formatEventPeriod } from "../historicalDate";
import {
  describeType,
  type EventPhoto,
  type HistoricalEvent,
  type Importance,
} from "../types";
import { palette } from "../../../theme/palette";

const IMPORTANCE_LABEL: Record<Importance, string> = {
  high: "élevée",
  medium: "moyenne",
  low: "faible",
};

const TRASH = require("../../../../assets/icons/trash.png");

export type EventDetailModalProps = {
  event: HistoricalEvent | null;
  onEdit: () => void;
  onClose: () => void;
};

export function EventDetailModal({
  event,
  onEdit,
  onClose,
}: EventDetailModalProps) {
  const { folders, removeEvent } = useEvents();
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);
  const [viewing, setViewing] = useState<EventPhoto | null>(null);

  if (!event) return null;

  const confirmDelete = () => {
    Alert.alert(
      "Supprimer cet événement ?",
      "Cette action est définitive.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await removeEvent(event.id);
              onClose();
            } catch (cause) {
              Alert.alert(
                "Suppression impossible",
                cause instanceof Error ? cause.message : String(cause),
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Paper
          style={[
            styles.sheet,
            { marginTop: insets.top + 24, marginBottom: insets.bottom + 24 },
          ]}
        >
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.period}>{formatEventPeriod(event)}</Text>
            <Text style={styles.title}>{event.title}</Text>
            <Text style={styles.type}>
              {describeType(event.type).emoji} {describeType(event.type).label}
            </Text>

            {event.description ? (
              <Text style={styles.description}>{event.description}</Text>
            ) : null}

            {event.folders.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.legend}>Classeurs</Text>
                {event.folders.map((link) => (
                  <Text key={link.folderId} style={styles.folderRow}>
                    {folders.find((f) => f.id === link.folderId)?.name ??
                      "Classeur supprimé"}
                    <Text style={styles.importance}>
                      {"  —  importance "}
                      {IMPORTANCE_LABEL[link.importance]}
                    </Text>
                  </Text>
                ))}
              </View>
            ) : null}

            {event.photos.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.section}
              >
                <View style={styles.photos}>
                  {event.photos.map((photo) => (
                    <Pressable
                      key={photo.id}
                      accessibilityRole="imagebutton"
                      accessibilityLabel="Agrandir la photo"
                      onPress={() => setViewing(photo)}
                      style={({ pressed }) => (pressed ? styles.dim : undefined)}
                    >
                      <Image source={{ uri: photo.url }} style={styles.photo} />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            ) : null}

            <Text style={styles.coordinates}>
              {event.latitude.toFixed(4)}°, {event.longitude.toFixed(4)}°
            </Text>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Supprimer cet événement"
                disabled={deleting}
                hitSlop={8}
                onPress={confirmDelete}
                style={({ pressed }) => [
                  styles.trash,
                  (pressed || deleting) && styles.trashPressed,
                ]}
              >
                <Image source={TRASH} style={styles.trashGlyph} resizeMode="contain" />
              </Pressable>

              <View style={styles.buttons}>
                <InkButton label="Modifier" onPress={onEdit} />
                <InkButton label="Fermer" variant="solid" onPress={onClose} />
              </View>
            </View>
          </ScrollView>
        </Paper>
      </View>

      <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(58, 44, 27, 0.45)",
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  sheet: { maxHeight: "100%" },
  body: { padding: 16, gap: 10 },
  period: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: palette.wax,
  },
  title: { fontSize: 21, color: palette.ink, letterSpacing: 0.4 },
  type: { fontSize: 12, color: palette.inkFaint, letterSpacing: 0.4 },
  description: { fontSize: 14, lineHeight: 21, color: palette.inkSoft },
  section: { marginTop: 6, gap: 4 },
  legend: {
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: palette.inkFaint,
  },
  folderRow: { fontSize: 13, color: palette.ink },
  importance: { color: palette.inkFaint, fontSize: 12 },
  photos: { flexDirection: "row", gap: 8 },
  photo: {
    width: 148,
    height: 108,
    borderWidth: 1,
    borderColor: palette.inkFaint,
  },
  dim: { opacity: 0.6 },
  coordinates: { fontSize: 11, color: palette.inkFaint, marginTop: 6 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  trash: { padding: 6 },
  trashPressed: { opacity: 0.45 },
  trashGlyph: { width: 20, height: 20 },
  buttons: { flexDirection: "row", gap: 8 },
});
