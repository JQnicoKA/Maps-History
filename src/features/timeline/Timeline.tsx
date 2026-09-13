import { useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { magnify, scaleFor, tickLabel, ticksBetween } from "./ruler";
import { Paper } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { formatYear, toSortKey } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

/**
 * How far the frieze opens under the finger. Six is enough to separate two
 * events a decade apart on a span of eight centuries, and still leaves the far
 * ends of the rule readable rather than crushed.
 */
const MAGNIFY = 6;

/**
 * How close to a mark the finger has to come for that event to count as being
 * read — measured on the frieze **as drawn**, so opening the rule makes the
 * choice correspondingly finer. That is what the magnification is for.
 */
const SNAP = 20;

/** A frieze of one year would be a dot; give a lone event room to sit in. */
const MIN_SPAN = 120;

/** Breathing room past the first and last events, as a share of the span. */
const MARGIN = 0.06;

/**
 * The map follows the finger, but not at sixty frames a second: each new year
 * is a round trip for the borders. Far enough apart to be cheap, close enough
 * that the world keeps up with the drag.
 */
const COMMIT_MS = 200;

/** Closest two light strokes may be drawn, once the lens has moved them. */
const CULL_PX = 5;

/** Closest two year labels may sit without touching. */
const LABEL_PX = 46;

/**
 * The whole card is the grab zone, not just the rule itself, so the horizontal
 * padding has to come off the touch before it means anything in ruler
 * coordinates.
 */
const INSET = space.lg;

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

type Tick = { year: number; at: number; major: boolean; label: string | null };

/**
 * The frieze is a graduated year scrubber, not a list of events.
 *
 * Dragging it moves through the centuries continuously; letting go anywhere is
 * allowed, including on a year where nothing happened — the borders and the
 * settlements still redraw for it, which is most of the point. Events are
 * marks along the rule, and coming within reach of one is what opens it.
 *
 * While the finger is down the rule **opens around it**: the graduations near
 * the touch spread apart and grow finer, the ones further off close up, and
 * both ends stay where they were. The span is never cut, so the whole of it
 * stays reachable without letting go.
 */
export function Timeline() {
  const { visibleEvents, selectedEvent, year, scrubTo } = useEvents();
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<{ year: number; at: number } | null>(null);

  const marks = useMemo(
    () =>
      visibleEvents.map((event) => ({
        id: event.id,
        key: toSortKey(event.start),
      })),
    [visibleEvents],
  );

  const span = useMemo(() => {
    if (marks.length === 0) return null;
    const keys = marks.map((mark) => mark.key);
    let from = Math.min(...keys);
    let to = Math.max(...keys);
    const margin = Math.max((to - from) * MARGIN, 4);
    from -= margin;
    to += margin;
    if (to - from < MIN_SPAN) {
      const middle = (from + to) / 2;
      from = middle - MIN_SPAN / 2;
      to = middle + MIN_SPAN / 2;
    }
    return { from, to, length: to - from };
  }, [marks]);

  /**
   * The gesture handler is built once and never rebuilt — a PanResponder made
   * fresh on every render loses the drag in progress. It therefore reads the
   * geometry through a ref rather than through the closure it was born with.
   */
  const live = useRef({ width, span, marks, scrubTo });
  live.current = { width, span, marks, scrubTo };

  const grabbed = useRef(0);
  const committed = useRef(0);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // The frieze sits above the map: once the finger is ours, keep it.
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (event) => {
          grabbed.current = event.nativeEvent.locationX - INSET;
          committed.current = 0;
          move(grabbed.current, true);
        },
        onPanResponderMove: (_, gesture) => {
          move(grabbed.current + gesture.dx, false);
        },
        onPanResponderRelease: (_, gesture) => {
          move(grabbed.current + gesture.dx, true);
          setDrag(null);
        },
        onPanResponderTerminate: () => setDrag(null),
      }),
    [],
  );

  /**
   * @param now  bypasses the throttle — the first touch and the release must
   *             both land on the map immediately.
   */
  function move(rawX: number, now: boolean) {
    const { width: w, span: s, marks: m, scrubTo: commit } = live.current;
    if (!s || w === 0) return;

    const at = clamp(rawX, 0, w);
    const under = s.from + (at / w) * s.length;

    // Nearest mark, judged on the frieze as the reader sees it: under the lens
    // the same twenty points cover far fewer years, so the choice sharpens
    // exactly where the reader is looking.
    let reading: { id: string; key: number } | null = null;
    let best = SNAP;
    for (const mark of m) {
      const drawn = magnify(
        ((mark.key - s.from) / s.length) * w,
        at,
        w,
        MAGNIFY,
      );
      const distance = Math.abs(drawn - at);
      if (distance <= best) {
        best = distance;
        reading = mark;
      }
    }

    // When a mark is read the needle goes onto the mark rather than staying
    // under the finger, and the lens focuses there too — so the mark it has
    // chosen is drawn exactly beneath the needle instead of a few points off.
    setDrag({
      year: reading ? reading.key : under,
      at: reading ? ((reading.key - s.from) / s.length) * w : at,
    });

    const stamp = Date.now();
    if (now || stamp - committed.current >= COMMIT_MS) {
      committed.current = stamp;
      commit(reading ? reading.key : under, reading?.id ?? null);
    }
  }

  const shown = drag?.year ?? year ?? span?.from ?? 0;
  const resting =
    span === null || width === 0
      ? 0
      : clamp((shown - span.from) / span.length, 0, 1) * width;
  // The needle sits under the finger while dragging; the rule opens around it.
  const needle = drag?.at ?? resting;
  const lens = drag ? MAGNIFY : 1;

  const ticks = useMemo<Tick[]>(() => {
    if (span === null || width === 0) return [];
    const scale = scaleFor(width / span.length, lens);
    const place = (value: number) =>
      magnify(((value - span.from) / span.length) * width, needle, width, lens);

    const strokes = [
      ...ticksBetween(span.from, span.to, scale.major).map((value) => ({
        year: value,
        at: place(value),
        major: true,
      })),
      ...ticksBetween(span.from, span.to, scale.minor)
        .filter((value) => value % scale.major !== 0)
        .map((value) => ({ year: value, at: place(value), major: false })),
    ].sort((a, b) => a.at - b.at);

    // The lens squeezes the far end of the rule together; drop whatever no
    // longer has room to be a stroke of its own. Where a heavy stroke and a
    // light one are competing for the same few points the heavy one wins —
    // otherwise the compressed end turns into a row of overlapping landmarks.
    const kept: { year: number; at: number; major: boolean }[] = [];
    for (const stroke of strokes) {
      const last = kept[kept.length - 1];
      if (last && stroke.at - last.at < CULL_PX) {
        if (stroke.major && !last.major) kept[kept.length - 1] = stroke;
        continue;
      }
      kept.push(stroke);
    }

    let lastLabel = -Infinity;
    return kept.map((stroke) => {
      const labelled = stroke.major && stroke.at - lastLabel >= LABEL_PX;
      if (labelled) lastLabel = stroke.at;
      return { ...stroke, label: labelled ? tickLabel(stroke.year) : null };
    });
  }, [span, width, needle, lens]);

  if (marks.length === 0 || span === null) {
    return (
      <Paper>
        <Text style={styles.empty}>Aucun événement pour ces filtres.</Text>
      </Paper>
    );
  }

  return (
    <Paper>
      <View style={styles.body} {...responder.panHandlers}>
        <View style={styles.caption}>
          <View
            style={[
              styles.pill,
              drag ? styles.pillOpen : null,
              { left: clamp(needle - PILL / 2, 0, Math.max(width - PILL, 0)) },
            ]}
          >
            <Text
              style={[styles.pillText, drag ? styles.pillTextOpen : null]}
              numberOfLines={1}
            >
              {formatYear(Math.round(shown))}
            </Text>
          </View>
        </View>

        <View
          style={styles.rule}
          onLayout={(event: LayoutChangeEvent) =>
            setWidth(event.nativeEvent.layout.width)
          }
        >
          <View style={styles.baseline} />

          {ticks.map((tick) => (
            <View key={tick.year} style={[styles.tickColumn, { left: tick.at }]}>
              <View style={tick.major ? styles.tickMajor : styles.tickMinor} />
              {tick.label === null ? null : (
                <Text style={styles.tickLabel} numberOfLines={1}>
                  {tick.label}
                </Text>
              )}
            </View>
          ))}

          {marks.map((mark) => (
            <View
              key={mark.id}
              style={[
                styles.mark,
                mark.id === selectedEvent?.id ? styles.markReading : null,
                {
                  left: magnify(
                    ((mark.key - span.from) / span.length) * width,
                    needle,
                    width,
                    lens,
                  ),
                },
              ]}
            />
          ))}

          <View style={[styles.needle, { left: needle }]} />
        </View>
      </View>
    </Paper>
  );
}

const PILL = 86;
const RULE = 42;
const MARK = 9;
const COLUMN = 40;
const LINE = 9;

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: INSET,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  caption: { height: 26 },
  pill: {
    position: "absolute",
    width: PILL,
    alignItems: "center",
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
  },
  pillOpen: { paddingVertical: 4 },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: palette.paperLight,
  },
  pillTextOpen: { fontSize: 15 },

  rule: { height: RULE },
  baseline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: LINE,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.line,
  },
  // Strokes hang below the line, the way they do on a rule.
  tickColumn: {
    position: "absolute",
    top: LINE,
    width: COLUMN,
    marginLeft: -COLUMN / 2,
    alignItems: "center",
  },
  tickMinor: {
    width: StyleSheet.hairlineWidth,
    height: 5,
    backgroundColor: palette.inkFaint,
  },
  tickMajor: {
    width: 1.5,
    height: 11,
    borderRadius: radius.pill,
    backgroundColor: palette.inkSoft,
  },
  tickLabel: {
    marginTop: 2,
    fontSize: 10,
    letterSpacing: 0.2,
    color: palette.inkSoft,
  },

  // Events ride on the line itself, above the graduations.
  mark: {
    position: "absolute",
    top: LINE - MARK / 2,
    width: MARK,
    height: MARK,
    marginLeft: -MARK / 2,
    borderRadius: radius.pill,
    backgroundColor: palette.inkSoft,
    borderWidth: 2,
    borderColor: palette.paperLight,
  },
  markReading: { backgroundColor: palette.wax },
  needle: {
    position: "absolute",
    top: 0,
    width: 2,
    height: 24,
    marginLeft: -1,
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
  },
  empty: {
    paddingVertical: space.xl,
    textAlign: "center",
    ...type.body,
    color: palette.inkSoft,
  },
});
