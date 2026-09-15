import { useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  InkButton,
  SegmentedControl,
  Sheet,
} from "../../../components/ui";
import { HISTORY } from "../../../config/history";
import {
  formatHistoricalDate,
  formatYear,
  MONTHS,
  toSortKey,
} from "../historicalDate";
import type { HistoricalDate } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, TOUCH, type } from "../../../theme/tokens";

const ROW = 38;
const VISIBLE = 5;
const PAD = (VISIBLE - 1) / 2;

const FIRST_YEAR = HISTORY.from;
const LAST_YEAR = HISTORY.to;

/** A snapping column. Virtualized, because the year wheel holds 5 200 rows. */
function Wheel({
  data,
  index,
  onIndexChange,
  flex,
}: {
  data: string[];
  index: number;
  onIndexChange: (index: number) => void;
  flex: number;
}) {
  const ref = useRef<FlatList<string>>(null);

  const settle = (offset: number) =>
    onIndexChange(
      Math.min(Math.max(Math.round(offset / ROW), 0), data.length - 1),
    );

  return (
    <View style={{ flex }}>
      <FlatList
        ref={ref}
        data={data}
        keyExtractor={(_, position) => String(position)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        initialScrollIndex={index}
        getItemLayout={(_, position) => ({
          length: ROW,
          offset: ROW * position,
          index: position,
        })}
        contentContainerStyle={{ paddingVertical: ROW * PAD }}
        // A slow drag ends without momentum, so both events have to be heard
        // or the wheel would settle on a row without reporting it.
        onScrollEndDrag={(event) => settle(event.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={(event) =>
          settle(event.nativeEvent.contentOffset.y)
        }
        renderItem={({ item, index: position }) => (
          <View style={styles.cell}>
            <Text
              style={[styles.cellText, position === index && styles.cellCurrent]}
              numberOfLines={1}
            >
              {item}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

/** "12 mars", "mars", or a note that only the year is known. */
function detailOf(date: HistoricalDate): string {
  if (date.month === undefined) return "Année seule";
  const month = MONTHS[date.month - 1] ?? "";
  return date.day === undefined ? month : `${date.day} ${month}`;
}

/**
 * The words the control wears. An event has a date and, if it lasted, an end;
 * a person has a birth and, if they died, a death. Same two dates, same wheels,
 * same magnetism — only the wording differs, so only the wording is a prop.
 */
export type DateLabels = {
  field: string;
  one: string;
  two: string;
  start: string;
  end: string;
  addEnd: string;
  dropEnd: string;
  backwards: [string, string];
};

const EVENT_LABELS: DateLabels = {
  field: "Date",
  one: "Date",
  two: "Période",
  start: "Début",
  end: "Fin",
  addEnd: "Ajouter une date de fin — pour ce qui dure",
  dropEnd: "Retirer la date de fin",
  backwards: [
    "Période à l'envers",
    "La date de fin tombe avant la date de début.",
  ],
};

export const LIFE_LABELS: DateLabels = {
  field: "Dates",
  one: "Naissance",
  two: "Naissance et mort",
  start: "Naissance",
  end: "Mort",
  addEnd: "Ajouter une date de mort",
  dropEnd: "Retirer la date de mort",
  backwards: ["Dates à l'envers", "La mort tombe avant la naissance."],
};

export type EventDateFieldProps = {
  start: HistoricalDate | null;
  end: HistoricalDate | null;
  onChange: (start: HistoricalDate, end: HistoricalDate | null) => void;
  labels?: DateLabels;
};

/**
 * When an event happened — one date, or two when it lasted.
 *
 * There used to be a switch on the form saying *Période*, which asked the
 * reader to declare the shape of the answer before giving it. The question
 * belongs where the answer is: the end date is offered **inside** the picker,
 * as a dashed slot under the wheels, and only once it has been added do the
 * two segments appear to move between start and end.
 *
 * At rest the year is set in the largest type on the form, because on this map
 * it is the most consequential thing about an event — it is what moves the
 * borders. An event known only to the year says so, rather than looking
 * unfinished.
 *
 * Three wheels rather than the system date picker, which cannot express what
 * this app stores: a year on its own ("1299"), a month without a day, or a year
 * before Christ. The dash at the top of the day and month wheels is what keeps
 * an imprecise date imprecise instead of inventing a 1st of January.
 */
export function EventDateField({
  start,
  end,
  onChange,
  labels = EVENT_LABELS,
}: EventDateFieldProps) {
  const [open, setOpen] = useState(false);

  const years = useMemo(
    () =>
      Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) =>
        formatYear(FIRST_YEAR + i),
      ),
    [],
  );
  const days = useMemo(
    () => ["—", ...Array.from({ length: 31 }, (_, i) => String(i + 1))],
    [],
  );
  const months = useMemo(() => ["—", ...MONTHS], []);

  const [draftStart, setDraftStart] = useState<HistoricalDate>(
    start ?? { year: new Date().getFullYear() },
  );
  const [draftEnd, setDraftEnd] = useState<HistoricalDate | null>(end);
  const [editing, setEditing] = useState<"start" | "end">("start");

  const draft = editing === "end" && draftEnd ? draftEnd : draftStart;
  const setDraft = (
    update: (state: HistoricalDate) => HistoricalDate,
  ): void => {
    if (editing === "end" && draftEnd) setDraftEnd(update(draftEnd));
    else setDraftStart(update(draftStart));
  };

  const yearIndex = Math.min(
    Math.max(draft.year - FIRST_YEAR, 0),
    years.length - 1,
  );

  const reopen = () => {
    setDraftStart(start ?? { year: new Date().getFullYear() });
    setDraftEnd(end);
    setEditing("start");
    setOpen(true);
  };

  const confirm = () => {
    // Mirrors the database's own `end_after_start`, so a period the wrong way
    // round is caught here with a sentence rather than there with an error.
    if (draftEnd && toSortKey(draftEnd) < toSortKey(draftStart)) {
      Alert.alert(labels.backwards[0], labels.backwards[1]);
      return;
    }
    onChange(draftStart, draftEnd);
    setOpen(false);
  };

  const period = start !== null && end !== null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{labels.field}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={start ? formatHistoricalDate(start) : labels.field}
        onPress={reopen}
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      >
        <View style={styles.tileText}>
          <Text
            style={[
              styles.year,
              period && styles.yearPeriod,
              !start && styles.yearEmpty,
            ]}
            numberOfLines={1}
          >
            {!start
              ? "—"
              : period
                ? `${formatYear(start.year)} – ${formatYear(end.year)}`
                : formatYear(start.year)}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            {!start
              ? "Toucher pour choisir"
              : period
                ? `${detailOf(start)} → ${detailOf(end)}`
                : detailOf(start)}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={draftEnd ? labels.two : labels.one}
        footer={
          <>
            <InkButton
              label="Annuler"
              variant="tonal"
              grow
              onPress={() => setOpen(false)}
            />
            <InkButton label="Valider" variant="solid" grow onPress={confirm} />
          </>
        }
      >
        <View style={styles.sheet}>
          {draftEnd ? (
            <SegmentedControl
              segments={[
                { value: "start" as const, label: labels.start },
                { value: "end" as const, label: labels.end },
              ]}
              value={editing}
              onChange={setEditing}
            />
          ) : null}

          <View style={styles.wheels}>
            {/* The centre band shows which row is selected. */}
            <View pointerEvents="none" style={styles.band} />

            <Wheel
              flex={1}
              data={days}
              index={draft.day ?? 0}
              onIndexChange={(index) =>
                setDraft((state) =>
                  index === 0 || state.month === undefined
                    ? {
                        year: state.year,
                        ...(state.month ? { month: state.month } : {}),
                      }
                    : { ...state, day: index },
                )
              }
            />
            <Wheel
              flex={1.6}
              data={months}
              index={draft.month ?? 0}
              onIndexChange={(index) =>
                setDraft((state) =>
                  // A day cannot outlive its month.
                  index === 0
                    ? { year: state.year }
                    : { ...state, month: index },
                )
              }
            />
            <Wheel
              flex={1.6}
              data={years}
              index={yearIndex}
              onIndexChange={(index) =>
                setDraft((state) => ({ ...state, year: FIRST_YEAR + index }))
              }
            />
          </View>

          <Text style={styles.preview}>
            {draftEnd
              ? `${formatHistoricalDate(draftStart)} → ${formatHistoricalDate(draftEnd)}`
              : formatHistoricalDate(draftStart)}
          </Text>

          {draftEnd ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setDraftEnd(null);
                setEditing("start");
              }}
              hitSlop={6}
              style={styles.dropTarget}
            >
              <Text style={styles.drop}>{labels.dropEnd}</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={labels.addEnd}
              onPress={() => {
                // Opens on the start's year, which is where a period begins.
                setDraftEnd({ year: draftStart.year });
                setEditing("end");
              }}
              style={({ pressed }) => [styles.add, pressed && styles.pressed]}
            >
              <Text style={styles.addGlyph}>+</Text>
              <Text style={styles.addLabel}>{labels.addEnd}</Text>
            </Pressable>
          )}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
  label: { ...type.legend, color: palette.inkSoft },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: TOUCH + space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: palette.sunken,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.65 },
  tileText: { flex: 1, gap: 1 },
  year: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: 0.2,
    fontWeight: "700",
    color: palette.ink,
  },
  // Two years and a dash need more room than one.
  yearPeriod: { fontSize: 20, lineHeight: 26 },
  yearEmpty: { color: palette.inkFaint },
  detail: { ...type.caption, color: palette.inkSoft },
  chevron: { fontSize: 22, color: palette.inkFaint },

  sheet: { paddingHorizontal: space.xl, gap: space.lg },
  wheels: { flexDirection: "row", height: ROW * VISIBLE, gap: space.sm },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ROW * PAD,
    height: ROW,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  cell: { height: ROW, alignItems: "center", justifyContent: "center" },
  cellText: { fontSize: 17, color: palette.inkFaint },
  cellCurrent: { fontSize: 19, color: palette.ink, fontWeight: "600" },
  preview: {
    textAlign: "center",
    fontSize: 15,
    letterSpacing: 0.3,
    color: palette.wax,
    fontWeight: "600",
  },
  // Dashed, so it reads as a slot waiting to be filled rather than a button.
  add: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    minHeight: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.line,
  },
  addGlyph: { fontSize: 18, lineHeight: 20, color: palette.inkSoft },
  addLabel: { ...type.caption, color: palette.inkSoft, fontWeight: "500" },
  dropTarget: { alignItems: "center", minHeight: TOUCH, justifyContent: "center" },
  drop: { ...type.caption, color: palette.wax, fontWeight: "600" },
});
