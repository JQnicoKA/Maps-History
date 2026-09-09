import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PhotoViewer } from "./PhotoViewer";
import { InkButton, Sheet } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { formatEventPeriod } from "../historicalDate";
import {
  describeType,
  type EventPhoto,
  type HistoricalEvent,
  type Importance,
} from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, TOUCH, type } from "../../../theme/tokens";

const TRASH = require("../../../../assets/icons/trash.png");

const IMPORTANCE_LABEL: Record<Importance, string> = {
  high: "élevée",
  medium: "moyenne",
  low: "faible",
};

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
  const [deleting, setDeleting] = useState(false);
  const [viewing, setViewing] = useState<EventPhoto | null>(null);

  if (!event) return null;

  const confirmDelete = () => {
    Alert.alert("Supprimer cet événement ?", "Cette action est définitive.", [
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
    ]);
  };

  const { emoji, label } = describeType(event.type);

  return (
    <Sheet
      visible
      onClose={onClose}
      footer={
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Supprimer cet événement"
            disabled={deleting}
            onPress={confirmDelete}
            style={({ pressed }) => [
              styles.trash,
              (pressed || deleting) && styles.trashPressed,
            ]}
          >
            <Image source={TRASH} style={styles.trashGlyph} resizeMode="contain" />
          </Pressable>
          <InkButton label="Modifier" variant="tonal" grow onPress={onEdit} />
          <InkButton label="Fermer" variant="solid" grow onPress={onClose} />
        </>
      }
    >
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeEmoji}>{emoji}</Text>
            <Text style={styles.badgeLabel}>{label}</Text>
          </View>
          <Text style={styles.period}>{formatEventPeriod(event)}</Text>
          <Text style={styles.title}>{event.title}</Text>
        </View>

        {event.description ? (
          <Text style={styles.description}>{event.description}</Text>
        ) : null}

        {event.photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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

        {event.folders.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.legend}>Classeurs</Text>
            {event.folders.map((link) => (
              <View key={link.folderId} style={styles.folderRow}>
                <Text style={styles.folderName} numberOfLines={1}>
                  {folders.find((f) => f.id === link.folderId)?.name ??
                    "Classeur supprimé"}
                </Text>
                <Text style={styles.importance}>
                  {IMPORTANCE_LABEL[link.importance]}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.coordinates}>
          {event.latitude.toFixed(4)}°, {event.longitude.toFixed(4)}°
        </Text>
      </ScrollView>

      <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.lg,
  },
  header: { gap: space.sm },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: palette.sunken,
  },
  badgeEmoji: { fontSize: 14 },
  badgeLabel: { fontSize: 13, color: palette.inkSoft, fontWeight: "500" },
  period: { fontSize: 14, color: palette.wax, fontWeight: "600" },
  title: { fontSize: 24, lineHeight: 30, color: palette.ink, fontWeight: "700" },
  description: { ...type.body, color: palette.inkSoft },
  section: { gap: space.sm },
  legend: { ...type.legend, color: palette.inkFaint },
  folderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: palette.sunken,
  },
  folderName: { flex: 1, fontSize: 15, color: palette.ink },
  importance: { fontSize: 13, color: palette.inkSoft },
  photos: { flexDirection: "row", gap: space.md },
  photo: { width: 168, height: 120, borderRadius: radius.md },
  dim: { opacity: 0.6 },
  coordinates: { ...type.caption, color: palette.inkFaint },
  trash: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  trashPressed: { opacity: 0.5 },
  trashGlyph: { width: 20, height: 20 },
});
