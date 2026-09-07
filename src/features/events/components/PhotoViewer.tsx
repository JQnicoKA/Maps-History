import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Paper } from "../../../components/ui";
import type { EventPhoto } from "../types";
import { palette } from "../../../theme/palette";

export type PhotoViewerProps = {
  photo: EventPhoto | null;
  onClose: () => void;
};

const isLink = (source: string) => /^https?:\/\//i.test(source.trim());

/**
 * Sits above the detail sheet: the picture at full width, and underneath it
 * where it came from — a link that opens, or a plain reference.
 */
export function PhotoViewer({ photo, onClose }: PhotoViewerProps) {
  const insets = useSafeAreaInsets();
  if (!photo) return null;

  const source = photo.source?.trim();

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Fermer"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          style={[
            styles.content,
            { marginTop: insets.top + 20, marginBottom: insets.bottom + 20 },
          ]}
        >
          <Pressable onPress={onClose}>
            <Image
              source={{ uri: photo.url }}
              style={styles.image}
              resizeMode="contain"
            />
          </Pressable>

          {source ? (
            <Paper style={styles.caption}>
              <Pressable
                disabled={!isLink(source)}
                onPress={() => void Linking.openURL(source)}
                style={styles.captionBody}
              >
                <Text style={styles.legend}>Source</Text>
                <Text
                  style={[styles.source, isLink(source) && styles.link]}
                  numberOfLines={4}
                >
                  {source}
                </Text>
              </Pressable>
            </Paper>
          ) : null}

          <Text style={styles.hint}>Toucher pour fermer</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(28, 21, 13, 0.88)",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  content: { gap: 12 },
  image: { width: "100%", flexShrink: 1, minHeight: 200, aspectRatio: 1 },
  caption: {},
  captionBody: { padding: 12, gap: 4 },
  legend: {
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: palette.inkFaint,
  },
  source: { fontSize: 13, lineHeight: 19, color: palette.ink },
  link: { color: palette.wax, textDecorationLine: "underline" },
  hint: {
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 1,
    color: palette.paperDeep,
    opacity: 0.7,
  },
});
