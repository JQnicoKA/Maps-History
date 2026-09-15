import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type NativeTouchEvent,
} from "react-native";

import {
  clampOffset,
  fit,
  zoomAround,
  type Inset,
  type Offset,
  type Size,
  type View as Viewing,
} from "./viewport";

export type PanZoomProps = {
  /** The drawing's own size, in its own points. */
  content: Size;
  /** How much of the window the floating bars cover. */
  inset: Inset;
  /**
   * Changing this re-frames the drawing. Pass the identity of what is being
   * shown — a new tree deserves a fresh framing, a tree that merely grew does
   * not, since the reader is in the middle of arranging it.
   */
  subject: string;
  children: ReactNode;
};

/** Past this, a finger is panning and not tapping. */
const SLOP = 6;
/** Per frame, on a flung canvas. */
const FRICTION = 0.94;
/** Below this, in points per frame, the glide has arrived. */
const STILL = 0.4;

/**
 * A window onto something larger: drag to move, pinch to zoom.
 *
 * Written by hand rather than leant on a `ScrollView` for one reason — the two
 * nested scroll views this replaces could pan but never zoom, and zooming an
 * inner one leaves half of it off the screen for good. Here the transform is
 * ours, so a pinch is three lines of arithmetic (`viewport.ts`) and panning
 * keeps working at any scale.
 *
 * **The touch is claimed on movement, not on touch-down.** The drawing is full
 * of buttons; if this took every touch as it landed, nothing inside could be
 * tapped. Past a few points of travel it takes the gesture away from whatever
 * child had it, which is exactly what dragging from a portrait should do.
 */
export function PanZoom({ content, inset, subject, children }: PanZoomProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const magnify = useRef(new Animated.Value(1)).current;

  /** The truth about where we are looking; the Animated values only show it. */
  const view = useRef<Viewing>({ scale: 1, offset: { x: 0, y: 0 } });
  const window = useRef<Size>({ width: 0, height: 0 });
  /** Where the window sits on the screen, to read touches against. */
  const corner = useRef<Offset>({ x: 0, y: 0 });
  const frame = useRef<View>(null);

  // The gesture handlers are built once and live as long as the component, so
  // everything they read has to be a ref rather than a captured prop.
  const latest = useRef({ content, inset });
  latest.current = { content, inset };

  const grip = useRef<Grip | null>(null);
  const drift = useRef<Offset>({ x: 0, y: 0 });
  const gliding = useRef<number | null>(null);

  const show = () => {
    translateX.setValue(view.current.offset.x);
    translateY.setValue(view.current.offset.y);
    magnify.setValue(view.current.scale);
  };

  const settle = () => {
    const { content: size, inset: bars } = latest.current;
    view.current.offset = clampOffset(view.current, size, window.current, bars);
    show();
  };

  const stopGlide = () => {
    if (gliding.current !== null) cancelAnimationFrame(gliding.current);
    gliding.current = null;
  };

  const glide = () => {
    const step = () => {
      const speed = drift.current;
      if (Math.hypot(speed.x, speed.y) < STILL) {
        gliding.current = null;
        return;
      }
      const before = view.current.offset;
      view.current.offset = { x: before.x + speed.x, y: before.y + speed.y };
      settle();
      // A run that hits an edge stops dead in that direction rather than
      // grinding against it for another second.
      const after = view.current.offset;
      drift.current = {
        x: after.x === before.x + speed.x ? speed.x * FRICTION : 0,
        y: after.y === before.y + speed.y ? speed.y * FRICTION : 0,
      };
      gliding.current = requestAnimationFrame(step);
    };
    stopGlide();
    gliding.current = requestAnimationFrame(step);
  };

  const responder = useRef(
    PanResponder.create({
      // Empty canvas: ours from the start. Anything with a button on it goes
      // through the capture below instead.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (event, gesture) =>
        event.nativeEvent.touches.length >= 2 ||
        Math.hypot(gesture.dx, gesture.dy) > SLOP,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: () => {
        stopGlide();
        grip.current = null;
        drift.current = { x: 0, y: 0 };
      },

      onPanResponderMove: (event: GestureResponderEvent) => {
        const now = read(event.nativeEvent.touches, corner.current);
        const was = grip.current;
        grip.current = now;
        // A finger added or lifted moves the midpoint without the hand having
        // moved; treating that as a drag would make the canvas jump.
        if (!was || was.fingers !== now.fingers) return;

        const moved = { x: now.focal.x - was.focal.x, y: now.focal.y - was.focal.y };
        view.current = {
          scale: view.current.scale,
          offset: {
            x: view.current.offset.x + moved.x,
            y: view.current.offset.y + moved.y,
          },
        };

        if (now.fingers >= 2 && was.spread > 0) {
          view.current = zoomAround(view.current, now.focal, now.spread / was.spread);
        }

        drift.current = now.fingers >= 2 ? { x: 0, y: 0 } : moved;
        settle();
      },

      onPanResponderRelease: () => {
        grip.current = null;
        glide();
      },
      onPanResponderTerminate: () => {
        grip.current = null;
        drift.current = { x: 0, y: 0 };
      },
    }),
  ).current;

  // Frame the drawing when a different one is shown. Deliberately not on every
  // change of size: re-centring the canvas under someone who has just added a
  // generation would feel like the app snatching it away.
  useEffect(() => {
    const measure = () => {
      if (window.current.width === 0) return;
      view.current = fit(latest.current.content, window.current, latest.current.inset);
      show();
    };
    measure();
    // Nothing is measured on the very first pass; the layout below calls again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  // A fling outlives the gesture; it must not outlive the screen.
  useEffect(() => stopGlide, []);

  // The drawing grew or the bars were measured: keep what is on screen legal
  // without moving it any more than the new bounds require.
  useEffect(() => {
    if (window.current.width > 0) settle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.width, content.height, inset.top, inset.bottom]);

  return (
    <View
      ref={frame}
      style={styles.window}
      onLayout={() => {
        frame.current?.measureInWindow((x, y, width, height) => {
          const first = window.current.width === 0;
          corner.current = { x, y };
          window.current = { width, height };
          if (first) {
            view.current = fit(latest.current.content, window.current, latest.current.inset);
            show();
          } else {
            settle();
          }
        });
      }}
      {...responder.panHandlers}
    >
      <Animated.View
        style={[
          styles.sheet,
          {
            width: content.width,
            height: content.height,
            transform: [{ translateX }, { translateY }, { scale: magnify }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

type Grip = { focal: Offset; spread: number; fingers: number };

/** Where the hand is, and how open it is, in window points. */
function read(touches: NativeTouchEvent[], corner: Offset): Grip {
  const fingers = touches.length;
  const first = touches[0];
  if (!first) return { focal: { x: 0, y: 0 }, spread: 0, fingers: 0 };

  const second = touches[1];
  if (!second) {
    return {
      focal: { x: first.pageX - corner.x, y: first.pageY - corner.y },
      spread: 0,
      fingers,
    };
  }

  return {
    focal: {
      x: (first.pageX + second.pageX) / 2 - corner.x,
      y: (first.pageY + second.pageY) / 2 - corner.y,
    },
    spread: Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY),
    fingers,
  };
}

const styles = StyleSheet.create({
  window: { flex: 1, overflow: "hidden" },
  sheet: {
    position: "absolute",
    left: 0,
    top: 0,
    // With the corner as the anchor, a point p lands at offset + p * scale —
    // which is the one rule the whole of `viewport.ts` is written against.
    transformOrigin: "0% 0%",
  },
});
