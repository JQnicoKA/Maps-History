import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { useEvents } from "../events/EventsProvider";
import { formatYear, toSortKey } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { space } from "../../theme/tokens";

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

/** How far past the outermost events the frieze lets you wander. */
const MARGIN = 150;
const MIN_SPAN = 400;

/** Reserved by the screen beneath the summary card. */
export const FRIEZE_HEIGHT = 92;

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
 */
export function Timeline() {
  const { visibleEvents, selectedEvent, year, scrubTo } = useEvents();
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

  const span = useMemo(() => {
    if (marks.length === 0) return { from: 0, to: MIN_SPAN };
    const keys = marks.map((mark) => mark.key);
    let from = Math.min(...keys) - MARGIN;
    let to = Math.max(...keys) + MARGIN;
    if (to - from < MIN_SPAN) {
      const middle = (from + to) / 2;
      from = middle - MIN_SPAN / 2;
      to = middle + MIN_SPAN / 2;
    }
    return { from, to };
  }, [marks]);

  const at = local ?? year ?? span.from;

  /** Read by the gesture and the glide, neither of which may close over state. */
  const live = useRef({ width, span, marks, scrubTo, at });
  live.current = { width, span, marks, scrubTo, at };

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
    const { span: bounds, marks: m, scrubTo: commit } = live.current;
    const free = clamp(next, bounds.from, bounds.to);

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

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // The frieze lies over the map; once the finger is ours, keep it.
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: () => {
          stop();
          grabbed.current = live.current.at;
          committed.current = 0;
        },
        onPanResponderMove: (_, gesture) => {
          // Drag the rule, do not drive a cursor: pulling right brings earlier
          // years to the needle, which is how every ruler and wheel behaves.
          put(grabbed.current - gesture.dx * scale(), {
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

  if (marks.length === 0) {
    return (
      <View style={styles.root}>
        <Text style={styles.empty}>Aucun événement pour ces filtres.</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.root}
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width)
      }
      {...responder.panHandlers}
    >
      <Text style={styles.year}>{formatYear(Math.round(at))}</Text>

      <View style={styles.marks}>
        {marks.map((mark) => {
          const x = centre + (mark.key - at) * perYear;
          const fade = fadeAt(x);
          if (fade <= 0) return null;
          const reading = mark.id === selectedEvent?.id;
          return (
            <View
              key={mark.id}
              style={[
                styles.mark,
                reading && styles.markReading,
                { left: x, opacity: fade },
              ]}
            />
          );
        })}
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
        <View style={[styles.needle, { left: centre }]} />
      </View>
    </View>
  );
}

const MARK = 7;
const RULE = 26;

const styles = StyleSheet.create({
  root: { height: FRIEZE_HEIGHT, justifyContent: "flex-end" },
  year: {
    textAlign: "center",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: palette.ink,
  },
  marks: { height: MARK + space.sm, justifyContent: "flex-end" },
  mark: {
    position: "absolute",
    bottom: 4,
    width: MARK,
    height: MARK,
    marginLeft: -MARK / 2,
    borderRadius: MARK / 2,
    backgroundColor: palette.inkSoft,
  },
  markReading: {
    width: MARK + 4,
    height: MARK + 4,
    marginLeft: -(MARK + 4) / 2,
    borderRadius: (MARK + 4) / 2,
    backgroundColor: palette.wax,
  },
  rule: { height: RULE, justifyContent: "flex-start" },
  minor: {
    position: "absolute",
    top: 0,
    width: StyleSheet.hairlineWidth * 2,
    height: 9,
    marginLeft: -StyleSheet.hairlineWidth,
    backgroundColor: palette.inkSoft,
  },
  major: {
    position: "absolute",
    top: 0,
    width: 1.5,
    height: 20,
    marginLeft: -0.75,
    backgroundColor: palette.ink,
  },
  // The reading edge. Two points of wax, the height of a heavy stroke.
  needle: {
    position: "absolute",
    top: -4,
    width: 2,
    height: 28,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: palette.wax,
  },
  empty: {
    textAlign: "center",
    fontSize: 13,
    color: palette.inkSoft,
    paddingBottom: space.lg,
  },
});
