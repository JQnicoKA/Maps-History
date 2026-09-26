import { useRef } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import type { MapRef } from "@maplibre/maplibre-react-native";

import type { Stroke } from "./drawn";

export type BrushOverlayProps = {
  mapRef: { current: MapRef | null };
  /** Called with a finished stroke, in longitude and latitude. */
  onStroke: (stroke: Stroke) => void;
  /** Called on every point, so the trail can be drawn as it is laid down. */
  onTrail: (trail: Stroke) => void;
};

/**
 * Why there is no two-finger pan here, and a button instead.
 *
 * React Native hands a touch to one view at a time. The moment the first
 * finger lands, this sheet owns the gesture — and there is no way to give it
 * back mid-gesture, so the second finger never reaches the map and the pinch
 * does nothing. Detecting the second finger is easy; releasing the first is
 * what the framework does not offer.
 *
 * The alternatives were to re-implement panning and zooming here and drive
 * the camera ourselves — a second map engine, in effect — or to say plainly
 * which mode the reader is in. The drawing bar carries a brush/hand switch,
 * and while the hand is chosen this sheet steps aside entirely.
 */

/**
 * One point per this many screen points travelled.
 *
 * Every point costs a round trip to the native side to be turned into a
 * coordinate, and a stroke sampled at every pixel would carry hundreds of
 * them for no gain: the brush is wide, and a band is not made finer by
 * describing its middle more precisely.
 */
const SAMPLE = 14;

/**
 * The sheet a finger paints on.
 *
 * Laid over the frozen map, and it does one thing: turn a finger's path into
 * a list of coordinates. It never draws — the trail is rendered by the map
 * itself, as a line layer, because that is what guarantees the preview sits
 * exactly where the geometry will.
 *
 * **Two fingers are let through untouched.** The responder is claimed only
 * for a single touch, so a pinch reaches the map and the reader can zoom to
 * where they are working without leaving the brush.
 */
export function BrushOverlay({ mapRef, onStroke, onTrail }: BrushOverlayProps) {
  const stroke = useRef<Stroke>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  /**
   * Coordinates arrive from the native side out of order if two requests
   * overlap; this counts them so a late answer cannot land after an early one.
   */
  const asked = useRef(0);

  const add = (x: number, y: number) => {
    const rank = ++asked.current;
    void mapRef.current
      ?.unproject([x, y])
      .then((coordinate) => {
        // A point that arrives after the stroke was let go belongs to nothing.
        if (rank <= asked.current && stroke.current !== null) {
          stroke.current.push([coordinate[0], coordinate[1]]);
          onTrail([...stroke.current]);
        }
      })
      .catch(() => undefined);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (event) =>
        event.nativeEvent.touches.length === 1,
      onMoveShouldSetPanResponder: (event) =>
        event.nativeEvent.touches.length === 1,

      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        stroke.current = [];
        last.current = { x: locationX, y: locationY };
        add(locationX, locationY);
      },

      onPanResponderMove: (event) => {
        // A second finger joining is a pinch that will not happen — see above.
        // The stroke is at least not smeared by it.
        if (event.nativeEvent.touches.length > 1) return;

        const { locationX, locationY } = event.nativeEvent;
        const from = last.current;
        if (from && Math.hypot(locationX - from.x, locationY - from.y) < SAMPLE) {
          return;
        }
        last.current = { x: locationX, y: locationY };
        add(locationX, locationY);
      },

      onPanResponderRelease: () => {
        const painted = stroke.current;
        stroke.current = [];
        last.current = null;
        onTrail([]);
        if (painted.length > 0) onStroke(painted);
      },
      onPanResponderTerminate: () => {
        stroke.current = [];
        last.current = null;
        onTrail([]);
      },
    }),
  ).current;

  return <View style={StyleSheet.absoluteFill} {...responder.panHandlers} />;
}
