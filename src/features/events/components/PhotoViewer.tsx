import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { EventPhoto } from "../types";
import { palette } from "../../../theme/palette";
import { radius, shadow, space, TOUCH, type } from "../../../theme/tokens";

const SCREEN = Dimensions.get("window").height;

/** The band of paper around the picture. */
const MOUNT = 14;
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.8;

/** Same reason as in `Sheet`: a native-driven value ignores `setValue` mid-drag. */
const DRIVER = false;

type Box = { width: number; height: number };

/**
 * The largest box of the picture's own shape that fits the room available.
 *
 * Computed here rather than left to `resizeMode: "contain"`, which fits the
 * picture inside the frame and leaves the frame the wrong shape: the rounded
 * corners then belong to empty space and the caption lines up with nothing.
 * Sized exactly, the frame *is* the picture.
 */
function fit(ratio: number, room: Box): Box {
  if (room.width === 0 || room.height === 0) return { width: 0, height: 0 };
  const byWidth = { width: room.width, height: room.width / ratio };
  return byWidth.height <= room.height
    ? byWidth
    : { width: room.height * ratio, height: room.height };
}

export type PhotoViewerProps = {
  photo: EventPhoto | null;
  onClose: () => void;
};

const isLink = (source: string) => /^https?:\/\//i.test(source.trim());

/**
 * A photograph at its own proportions, mounted on paper, and underneath it
 * where it came from — a link that opens, or a plain reference.
 *
 * The mount is not decoration. A picture laid straight on the dark ground has
 * no edge of its own: a photograph that happens to be dark simply dissolves
 * into the backdrop, and one that is light floats with nothing holding it. The
 * band of paper around it is what an album or a framed print does, and what
 * this map's own chrome is made of.
 *
 * Three ways out, because a picture filling the screen should never feel like a
 * trap: the cross top right, a tap anywhere, or a swipe in either direction.
 *
 * Nothing shows until the picture has arrived. The source used to appear at
 * once and the photograph seconds later, which read as two openings rather than
 * one; a spinner now holds the place and both fade in together. The layout is
 * measured underneath while it waits, so nothing jumps when it lands.
 */
export function PhotoViewer({ photo, onClose }: PhotoViewerProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const dim = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;

  const [loaded, setLoaded] = useState(false);
  /** The picture's own width ÷ height, read off the load event. */
  const [ratio, setRatio] = useState(1);
  const [stage, setStage] = useState<Box>({ width: 0, height: 0 });
  /**
   * Measured rather than guessed: the source runs to four lines and the
   * picture has to give up exactly that much height, no more. The first pass
   * lays out with nothing reserved and the second corrects it — which nobody
   * sees, since none of this is revealed until the picture has loaded.
   */
  const [captionHeight, setCaptionHeight] = useState(0);

  const url = photo?.url;

  useEffect(() => {
    if (url === undefined) return;
    translateY.setValue(0);
    reveal.setValue(0);
    setLoaded(false);
    Animated.timing(dim, {
      toValue: 1,
      duration: 160,
      useNativeDriver: DRIVER,
    }).start();
  }, [url, translateY, dim, reveal]);

  /**
   * Called on success and on failure alike: a broken picture still beats a
   * spinner that never stops.
   */
  const show = () => {
    setLoaded(true);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 220,
      useNativeDriver: DRIVER,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      // Not claimed on touch here: a tap must still close the viewer.
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
  // The picture is inset by the mount's border on all four sides, and shares
  // the mount with the caption — whose own top margin is not in its measured
  // height, hence the extra band.
  const frame = fit(ratio, {
    width: Math.max(stage.width - MOUNT * 2, 0),
    height: Math.max(
      stage.height - MOUNT * 2 - (source ? captionHeight + MOUNT : 0),
      0,
    ),
  });

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

        {loaded ? null : (
          <View pointerEvents="none" style={styles.waiting}>
            <ActivityIndicator size="large" color={palette.paperLight} />
          </View>
        )}

        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.sheet,
            {
              paddingTop: insets.top + space.sm,
              paddingBottom: insets.bottom + space.lg,
              transform: [{ translateY }],
              opacity: reveal,
            },
          ]}
        >
          <View style={styles.bar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
          </View>

          {/* The stage is whatever is left between the bar and the caption,
              and is measured there — so a tall photograph loses height rather
              than overflowing, and a wide one loses width. The mount's height
              then follows the picture instead of filling the stage, which is
              what keeps a panorama from sitting in a field of paper. */}
          <Pressable
            style={styles.stage}
            onPress={onClose}
            onLayout={(event: LayoutChangeEvent) =>
              setStage({
                width: event.nativeEvent.layout.width,
                height: event.nativeEvent.layout.height,
              })
            }
          >
            <View style={styles.mount}>
              <Image
                source={{ uri: photo.url }}
                style={[styles.image, frame]}
                onLoad={(event) => {
                  const size = event.nativeEvent.source;
                  if (size.width > 0 && size.height > 0) {
                    setRatio(size.width / size.height);
                  }
                  show();
                }}
                onError={show}
              />

              {/* On the same mount as the picture, under a rule — a print and
                  its caption are one object, and two cards read as two. */}
              {source ? (
                <Pressable
                  disabled={!isLink(source)}
                  onPress={() => void Linking.openURL(source)}
                  style={styles.caption}
                  onLayout={(event: LayoutChangeEvent) =>
                    setCaptionHeight(event.nativeEvent.layout.height)
                  }
                >
                  <Text style={styles.legend}>Source</Text>
                  <Text
                    style={[styles.source, isLink(source) && styles.link]}
                    numberOfLines={4}
                  >
                    {source}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: { backgroundColor: "rgba(24, 18, 11, 0.9)" },
  waiting: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: { flex: 1, paddingHorizontal: space.lg, gap: space.md },
  bar: { flexDirection: "row", justifyContent: "flex-end" },
  close: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    // Paper at a whisper: visible on the dark ground without being a button
    // shouting over the photograph.
    backgroundColor: "rgba(240, 228, 202, 0.14)",
  },
  pressed: { opacity: 0.55 },
  closeGlyph: {
    fontSize: 26,
    lineHeight: 30,
    color: palette.paperLight,
    marginTop: -2,
  },
  stage: { flex: 1, justifyContent: "center" },
  mount: {
    width: "100%",
    padding: MOUNT,
    alignItems: "center",
    borderRadius: radius.xl,
    backgroundColor: palette.paperLight,
    ...shadow.lifted,
  },
  // Sized exactly, so the rounding belongs to the picture itself. A tighter
  // radius than the mount's: nested corners look wrong when they match.
  image: { borderRadius: radius.md, backgroundColor: palette.sunken },
  caption: {
    width: "100%",
    marginTop: MOUNT,
    paddingTop: MOUNT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    gap: space.xs,
  },
  legend: { ...type.legend, color: palette.inkFaint },
  source: { ...type.body, color: palette.ink },
  link: { color: palette.wax, fontWeight: "600" },
});
