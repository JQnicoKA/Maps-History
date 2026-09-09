import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Paper } from "../../../components/ui";
import type { EventPhoto } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, type } from "../../../theme/tokens";

const SCREEN = Dimensions.get("window").height;
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.8;

/** Same reason as in `Sheet`: a native-driven value ignores `setValue` mid-drag. */
const DRIVER = false;

export type PhotoViewerProps = {
  photo: EventPhoto | null;
  onClose: () => void;
};

const isLink = (source: string) => /^https?:\/\//i.test(source.trim());

/**
 * Sits above the detail sheet: the picture at full width, and underneath it
 * where it came from — a link that opens, or a plain reference. Swipe it away
 * in either direction, as a photo viewer should.
 */
export function PhotoViewer({ photo, onClose }: PhotoViewerProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const dim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!photo) return;
    translateY.setValue(0);
    Animated.timing(dim, {
      toValue: 1,
      duration: 160,
      useNativeDriver: DRIVER,
    }).start();
  }, [photo, translateY, dim]);

  const pan = useRef(
    PanResponder.create({
      // Not claimed on touch here: a tap on the image must still close it.
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 3 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(gesture.dy);
        dim.setValue(Math.max(0, 1 - Math.abs(gesture.dy) / (SCREEN * 0.5)));
      },
      onPanResponderRelease: (_, gesture) => {
        if (
          Math.abs(gesture.dy) > DISMISS_DISTANCE ||
          Math.abs(gesture.vy) > DISMISS_VELOCITY
        ) {
          onClose();
          return;
        }
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            damping: 24,
            stiffness: 260,
            useNativeDriver: DRIVER,
          }),
          Animated.timing(dim, {
            toValue: 1,
            duration: 120,
            useNativeDriver: DRIVER,
          }),
        ]).start();
      },
    }),
  ).current;

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
      <View style={styles.root}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.dim, { opacity: dim }]}
        >
          <Pressable
            accessibilityLabel="Fermer"
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.content,
            {
              marginTop: insets.top + space.xl,
              marginBottom: insets.bottom + space.xl,
              transform: [{ translateY }],
            },
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
            <Paper>
              <Pressable
                disabled={!isLink(source)}
                onPress={() => void Linking.openURL(source)}
                style={styles.caption}
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
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", paddingHorizontal: space.lg },
  dim: { backgroundColor: "rgba(24, 18, 11, 0.9)" },
  content: { gap: space.lg },
  image: {
    width: "100%",
    flexShrink: 1,
    minHeight: 200,
    aspectRatio: 1,
    borderRadius: radius.lg,
  },
  caption: { padding: space.lg, gap: space.xs },
  legend: { ...type.legend, color: palette.inkFaint },
  source: { ...type.body, color: palette.ink },
  link: { color: palette.wax, fontWeight: "600" },
});
