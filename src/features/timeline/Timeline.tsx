import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { HISTORY } from "../../config/history";
import { useEvents } from "../events/EventsProvider";
import { formatYear, toSortKey } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { radius, space } from "../../theme/tokens";

/**
 * Years across the screen. Fixed, and that is the whole idea: the scale never
 * changes underfoot, so a hand learns once how far a century is and the frieze
 * can be read without looking at a number.
 */
const SPAN = 300;

/** A stroke every ten years, a heavy one every hundred. */
const MINOR = 10;
const MAJOR = 100;

/** Points over which the strokes die away at each edge of the screen. */
const FADE = 96;

/** How near the needle an event has to pass to count as being read. */
const SNAP = 14;

/** The map follows, but each new year is a round trip for the borders. */
const COMMIT_MS = 180;

/** Per frame, at 60Hz. Below `STILL` years per second the glide is over. */
const FRICTION = 0.94;
const STILL = 6;

/** Reserved by the screen beneath the summary card. */
export const FRIEZE_HEIGHT = 88;

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

type Stroke = { year: number; at: number; major: boolean; fade: number };

/**
 * A ruler of years that runs under a fixed needle.
 *
 * The frieze used to hold the whole filtered period between two ends, which
 * made its scale depend on what happened to be on screen — a century was a
 * finger's width one moment and the whole plate the next. Here the scale is
 * fixed at three hundred years to the screen and the ruler travels instead, so
 * the gesture means the same thing every time and most of history is off-screen
 * on purpose, waiting to be swiped to.
 *
 * No card behind it: strokes on the plate, fading out at both edges, the way a
 * scale is engraved on a map rather than pasted onto it.
 *
 * Its range is fixed too, and deliberately not derived from the events. It was
 * once their outermost dates plus a margin, which meant an app with no events
 * had no frieze at all — and events are marks *on* a rule, not the thing that
 * brings it into being.
 */
/** One of the two small discs either side of the year. */
function Step({
  direction,
  disabled,
  onPress,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        direction === "previous" ? "Événement précédent" : "Événement suivant"
      }
      disabled={disabled}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        pressed && styles.stepPressed,
        disabled && styles.stepOff,
      ]}
    >
      <Text style={styles.stepGlyph}>
        {direction === "previous" ? "‹" : "›"}
      </Text>
    </Pressable>
  );
}

export function Timeline() {
  // The event being read needs no mark of its own here: magnetism has already
  // brought it under the needle, which is the mark.
  const { visibleEvents, neighbours, selectEvent, year, scrubTo } = useEvents();
  const [width, setWidth] = useState(0);

  /**
   * The year under the needle while the reader is working it. Null the rest of
   * the time, when the provider's year is the truth — which is what lets the
   * chevron beside the summary card move the frieze too.
   */
  const [local, setLocal] = useState<number | null>(null);

  const marks = useMemo(
    () =>
      visibleEvents.map((event) => ({
        id: event.id,
        key: toSortKey(event.start),
      })),
    [visibleEvents],
  );

  const at = local ?? year ?? HISTORY.from;

  /** Read by the gesture and the glide, neither of which may close over state. */
  const live = useRef({ width, marks, scrubTo, at });
  live.current = { width, marks, scrubTo, at };

  const committed = useRef(0);
  const frame = useRef<number | null>(null);
  const velocity = useRef(0);

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    velocity.current = 0;
  };

  useEffect(() => stop, []);

  /** Years per point at the current width. */
  const scale = () => SPAN / Math.max(live.current.width, 1);

  /**
   * Moves the rule to `next` and reports what it settled on.
   *
   * `magnetic` pulls the needle onto a mark that is within reach, which is what
   * keeps the year the map draws and the event the card names from disagreeing
   * by a decade. It is off while a flick is running: a rule that stuck to every
   * mark it flew past would stutter rather than glide.
   */
  function put(
    next: number,
    { commit: force, magnetic }: { commit: boolean; magnetic: boolean },
  ) {
    const { marks: m, scrubTo: commit } = live.current;
    const free = clamp(next, HISTORY.from, HISTORY.to);

    // Nearest mark to the needle, in points — so the rule holds whatever the
    // span, and matches what the reader sees at the centre of the screen.
    let reading: { id: string; key: number } | null = null;
    let best = SNAP;
    for (const mark of m) {
      const distance = Math.abs((mark.key - free) / scale());
      if (distance <= best) {
        best = distance;
        reading = mark;
      }
    }

    const settled = magnetic && reading ? reading.key : free;
    setLocal(settled);

    const stamp = Date.now();
    if (force || stamp - committed.current >= COMMIT_MS) {
      committed.current = stamp;
      commit(settled, reading?.id ?? null);
    }
    return settled;
  }

  /**
   * Carries the flick on after the finger leaves, and dies out on its own.
   *
   * The position is carried in a local rather than read back from state: a
   * frame must not depend on React having re-rendered since the last one.
   */
  function glide(start: number) {
    velocity.current = start;
    let value = live.current.at;
    let last = Date.now();

    const step = () => {
      const now = Date.now();
      const dt = Math.min(now - last, 48);
      last = now;

      velocity.current *= Math.pow(FRICTION, dt / 16);
      const next = value + velocity.current * (dt / 1000);
      const applied = put(next, { commit: false, magnetic: false });
      const stalled = Math.abs(applied - next) > 1e-6; // reached an end
      value = applied;

      if (Math.abs(velocity.current) < STILL || stalled) {
        stop();
        // The last step is magnetic: a flick that ends beside an event should
        // come to rest on it, not near it.
        put(value, { commit: true, magnetic: true });
        setLocal(null);
        return;
      }
      frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
  }

  const grabbed = useRef(0);
  /** Where the finger already was when the drag was claimed. */
  const grabbedAt = useRef(0);

  const responder = useMemo(
    () =>
      PanResponder.create({
        /**
         * Claimed on movement, not on touch — the two chevrons live inside
         * this area, and a responder taken on touch-down would swallow their
         * taps. Capture rather than bubble, so the drag is taken back from a
         * chevron once the finger actually travels.
         */
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 4,
        // The frieze lies over the map; once the finger is ours, keep it.
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (_, gesture) => {
          stop();
          grabbed.current = live.current.at;
          // `dx` is measured from the touch, which began before we claimed it.
          grabbedAt.current = gesture.dx;
          committed.current = 0;
        },
        onPanResponderMove: (_, gesture) => {
          // Drag the rule, do not drive a cursor: pulling right brings earlier
          // years to the needle, which is how every ruler and wheel behaves.
          put(grabbed.current - (gesture.dx - grabbedAt.current) * scale(), {
            commit: false,
            magnetic: true,
          });
        },
        onPanResponderRelease: (_, gesture) => {
          const flick = -gesture.vx * 1000 * scale();
          if (Math.abs(flick) > STILL) {
            glide(flick);
            return;
          }
          put(live.current.at, { commit: true, magnetic: true });
          setLocal(null);
        },
        onPanResponderTerminate: () => {
          put(live.current.at, { commit: true, magnetic: true });
          setLocal(null);
        },
      }),
    [],
  );

  const centre = width / 2;
  const perYear = width === 0 ? 0 : width / SPAN;

  /** How present a stroke is at this distance from the edges. */
  const fadeAt = (x: number) =>
    clamp(Math.min(x, width - x) / FADE, 0, 1);

  const strokes = useMemo<Stroke[]>(() => {
    if (width === 0) return [];
    const half = SPAN / 2 + MINOR;
    const first = Math.ceil((at - half) / MINOR) * MINOR;
    const out: Stroke[] = [];
    for (let value = first; value <= at + half; value += MINOR) {
      const x = centre + (value - at) * perYear;
      const fade = fadeAt(x);
      if (fade <= 0) continue;
      out.push({
        year: value,
        at: x,
        major: Math.abs(value % MAJOR) < 1e-6,
        fade,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, at, centre, perYear]);

  return (
    <View
      style={styles.root}
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width)
      }
      {...responder.panHandlers}
    >
      {/* The year, flanked by the two steps through events. The frieze walks
          years; these walk what happened in them. */}
      <View style={styles.head}>
        <Step
          direction="previous"
          disabled={neighbours.previous === null}
          onPress={() =>
            neighbours.previous && selectEvent(neighbours.previous.id)
          }
        />
        <View style={styles.pill}>
          <Text style={styles.year}>{formatYear(Math.round(at))}</Text>
        </View>
        <Step
          direction="next"
          disabled={neighbours.next === null}
          onPress={() => neighbours.next && selectEvent(neighbours.next.id)}
        />
      </View>

      <View style={styles.rule}>
        {strokes.map((stroke) => (
          <View
            key={stroke.year}
            style={[
              stroke.major ? styles.major : styles.minor,
              { left: stroke.at, opacity: stroke.fade },
            ]}
          />
        ))}

        {/* Events are strokes of the same family, in wax, standing among the
            graduations rather than hovering over them as dots did. They fall
            on their own years, so they sit between the tens and are told apart
            by colour and height, never by being somewhere else. */}
        {marks.map((mark) => {
          const x = centre + (mark.key - at) * perYear;
          const fade = fadeAt(x);
          if (fade <= 0) return null;
          return (
            <View
              key={mark.id}
              style={[styles.event, { left: x, opacity: fade }]}
            />
          );
        })}

        <View style={[styles.needle, { left: centre }]} />
      </View>
    </View>
  );
}

const RULE = 34;

/** The two chevrons. Small: they flank the year, they do not compete with it. */
const STEP = 30;

/**
 * Strokes hang from a common baseline, the way graduations do on a rule: the
 * short ones stop level with the tall ones at the bottom, and the difference
 * is taken off the top. Aligning them at the top instead left the small marks
 * floating above the line the eye follows.
 */
const STROKE = { minor: 13, event: 19, major: 27 };
const NEEDLE = 34;

const styles = StyleSheet.create({
  root: { height: FRIEZE_HEIGHT, justifyContent: "flex-end", gap: space.md },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
  },
  step: {
    width: STEP,
    height: STEP,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: STEP / 2,
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  stepPressed: { backgroundColor: palette.paperDeep },
  stepOff: { opacity: 0.35 },
  stepGlyph: {
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "600",
    color: palette.wax,
    marginTop: -1,
  },
  // The year in wax, like the needle under it and the ring round the marker
  // being read: the colour this map keeps for "where you are".
  pill: {
    paddingHorizontal: space.lg,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
  },
  year: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: palette.paperLight,
  },
  rule: { height: RULE, justifyContent: "flex-start" },
  minor: {
    position: "absolute",
    top: STROKE.major - STROKE.minor,
    width: 2,
    height: STROKE.minor,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: palette.inkSoft,
  },
  event: {
    position: "absolute",
    top: STROKE.major - STROKE.event,
    width: 2.5,
    height: STROKE.event,
    marginLeft: -1.25,
    borderRadius: 1.25,
    backgroundColor: palette.wax,
  },
  major: {
    position: "absolute",
    top: 0,
    width: 3,
    height: STROKE.major,
    marginLeft: -1.5,
    borderRadius: 1.5,
    backgroundColor: palette.ink,
  },
  // The reading edge: on the same baseline as the strokes, and overhanging
  // them at the top, so it is never mistaken for one of them.
  needle: {
    position: "absolute",
    top: STROKE.major - NEEDLE,
    width: 3,
    height: NEEDLE,
    marginLeft: -1.5,
    borderRadius: 1.5,
    backgroundColor: palette.wax,
  },
});
