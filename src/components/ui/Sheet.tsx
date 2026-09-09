import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { palette } from "../../theme/palette";
import { BACKDROP, radius, shadow, space, type } from "../../theme/tokens";

const SCREEN = Dimensions.get("window").height;

/** Past this drop — or this flick — the sheet is on its way out. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.8;

/**
 * The panel is animated on the JS thread on purpose. A value handed to the
 * native driver stops repainting reliably when `setValue` is called from JS,
 * which is exactly what a drag does — the sheet would refuse to follow the
 * finger. The JS thread is idle while a sheet is being dragged, so the cost is
 * not visible.
 */
const DRIVER = false;

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Pinned below the scrolling content — where the actions live. */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * A bottom sheet: it rises from the thumb rather than landing in the middle of
 * the screen, which is where every current mobile app puts a dialogue and where
 * a hand can actually reach it. Drag the header down to dismiss.
 *
 * The animation is driven here rather than by `animationType="slide"`, which
 * translates the whole modal — dimming included — so the backdrop appeared to
 * slide up with the panel. It now fades in place while only the panel travels.
 *
 * The backdrop is a sibling of the panel, never its parent: wrapping the panel
 * in a Pressable steals the touch responder and stops lists inside from
 * scrolling.
 */
export function Sheet({ visible, onClose, title, footer, children }: SheetProps) {
  const insets = useSafeAreaInsets();

  /** Kept mounted through the exit animation, then torn down. */
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN)).current;
  const dim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SCREEN);
      dim.setValue(0);
      Animated.parallel([
        Animated.timing(dim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: DRIVER,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 260,
          mass: 0.9,
          useNativeDriver: DRIVER,
        }),
      ]).start();
      return;
    }

    // Nothing to animate away on first render of a closed sheet.
    if (!mounted) return;

    Animated.parallel([
      Animated.timing(dim, { toValue: 0, duration: 160, useNativeDriver: DRIVER }),
      Animated.timing(translateY, {
        toValue: SCREEN,
        duration: 220,
        useNativeDriver: DRIVER,
      }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
    // `mounted` is read, not tracked: adding it would re-run the exit on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, translateY, dim]);

  /**
   * Only the header drags. Claiming the whole panel would fight every list
   * inside it for the same downward gesture.
   */
  const pan = useRef(
    PanResponder.create({
      // Claimed on touch, not on move: nothing in the header is tappable, and
      // waiting for a threshold let the first pixels of the drag escape.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 2 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy <= 0) return;
        translateY.setValue(gesture.dy);
        dim.setValue(Math.max(0, 1 - gesture.dy / (SCREEN * 0.6)));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
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

  if (!mounted) return null;

  return (
    <Modal
      visible
      animationType="none"
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

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.dock}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[styles.panel, { transform: [{ translateY }] }]}
          >
            {/* The whole header is the handle — a 4pt bar is not a target. */}
            <View {...pan.panHandlers} style={styles.header}>
              <View style={styles.grabZone}>
                <View style={styles.grab} />
              </View>
              {title ? <Text style={styles.title}>{title}</Text> : null}
            </View>

            {children}

            {footer ? (
              <View
                style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}
              >
                {footer}
              </View>
            ) : (
              <View style={{ height: insets.bottom + space.sm }} />
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: { backgroundColor: BACKDROP },
  dock: { flex: 1, justifyContent: "flex-end" },
  panel: {
    maxHeight: "92%",
    backgroundColor: palette.paperLight,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.lifted,
  },
  header: { paddingBottom: space.xs },
  grabZone: { alignItems: "center", paddingTop: space.md, paddingBottom: space.sm },
  grab: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.line,
  },
  title: {
    ...type.title,
    color: palette.ink,
    textAlign: "center",
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    flexDirection: "row",
    gap: space.md,
  },
});
