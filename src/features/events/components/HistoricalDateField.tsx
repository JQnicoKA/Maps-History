import { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { InkButton, Paper } from "../../../components/ui";
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

      {open ? (
        <Modal
          visible
          animationType="fade"
          transparent
          statusBarTranslucent
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.backdrop}>
            {/* A sibling, not a wrapper: a Pressable around the sheet would win
              the touch responder and the wheels would refuse to scroll. */}
            <Pressable
              accessibilityLabel="Fermer"
              style={StyleSheet.absoluteFill}
              onPress={() => setOpen(false)}
            />
            <View>
              <Paper>
                <View style={styles.sheet}>
                  <Text style={styles.title}>{label}</Text>

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
                        setDraft((state) => ({
                          ...state,
                          year: FIRST_YEAR + index,
                        }))
                      }
                    />
                  </View>

                  <Text style={styles.preview}>
                    {formatHistoricalDate(draft)}
                  </Text>

                  <View style={styles.actions}>
                    <InkButton
                      label="Annuler"
                      variant="quiet"
                      onPress={() => setOpen(false)}
                    />
                    <InkButton
                      label="Valider"
                      variant="solid"
                      onPress={() => {
                        onChange(draft);
                        setOpen(false);
                      }}
                    />
                  </View>
                </View>
              </Paper>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 5 },
  label: {
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: palette.inkSoft,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.inkFaint,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.6 },
  value: { flex: 1, fontSize: 15, color: palette.ink },
  placeholder: { color: palette.inkFaint },
  chevron: { fontSize: 12, color: palette.inkSoft },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(58, 44, 27, 0.45)",
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  sheet: { padding: 14, gap: 12 },
  title: {
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: palette.ink,
    textAlign: "center",
  },
  wheels: { flexDirection: "row", height: ROW * VISIBLE, gap: 4 },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ROW * PAD,
    height: ROW,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.inkFaint,
    backgroundColor: palette.paperDeep,
    opacity: 0.5,
  },
  cell: { height: ROW, alignItems: "center", justifyContent: "center" },
  cellText: { fontSize: 15, color: palette.inkFaint },
  cellCurrent: { fontSize: 17, color: palette.ink },
  preview: {
    textAlign: "center",
    fontSize: 13,
    letterSpacing: 0.6,
    color: palette.wax,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});
