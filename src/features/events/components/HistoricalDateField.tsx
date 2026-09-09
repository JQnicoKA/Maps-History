import { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { InkButton, Sheet } from "../../../components/ui";
import { radius, space, TOUCH, type } from "../../../theme/tokens";
import { formatHistoricalDate, formatYear } from "../historicalDate";
import type { HistoricalDate } from "../types";
import { palette } from "../../../theme/palette";

const ROW = 38;
const VISIBLE = 5;
const PAD = (VISIBLE - 1) / 2;

const FIRST_YEAR = -3000;
const LAST_YEAR = 2200;

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

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
              style={[
                styles.cellText,
                position === index && styles.cellCurrent,
              ]}
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

export type HistoricalDateFieldProps = {
  label: string;
  value: HistoricalDate | null;
  onChange: (value: HistoricalDate) => void;
};

/**
 * Three wheels rather than the system date picker, which cannot express what
 * this app stores: a year on its own ("1299"), a month without a day, or a year
 * before Christ. The dash at the top of the day and month wheels is what keeps
 * an imprecise date imprecise instead of inventing a 1st of January.
 */
export function HistoricalDateField({
  label,
  value,
  onChange,
}: HistoricalDateFieldProps) {
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

  const current = value ?? { year: new Date().getFullYear() };
  const [draft, setDraft] = useState<HistoricalDate>(current);

  const yearIndex = Math.min(
    Math.max(draft.year - FIRST_YEAR, 0),
    years.length - 1,
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setDraft(current);
          setOpen(true);
        }}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? formatHistoricalDate(value) : "Choisir une date"}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <>
            <InkButton
              label="Annuler"
              variant="tonal"
              grow
              onPress={() => setOpen(false)}
            />
            <InkButton
              label="Valider"
              variant="solid"
              grow
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}
            />
          </>
        }
      >
        <View style={styles.sheet}>
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
                  index === 0 ? { year: state.year } : { ...state, month: index },
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

          <Text style={styles.preview}>{formatHistoricalDate(draft)}</Text>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
  label: { ...type.legend, color: palette.inkSoft },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: TOUCH,
    paddingHorizontal: space.md,
    backgroundColor: palette.sunken,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.65 },
  value: { flex: 1, fontSize: 16, color: palette.ink },
  placeholder: { color: palette.inkFaint },
  chevron: { fontSize: 13, color: palette.inkSoft },
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
});
