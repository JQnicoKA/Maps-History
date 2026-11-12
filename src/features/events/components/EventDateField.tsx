import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  InkButton,
  SegmentedControl,
  Sheet,
} from "../../../components/ui";
import { HISTORY } from "../../../config/history";
import { useEvents } from "../EventsProvider";
import {
  ABOUT,
  formatDateYear,
  formatHistoricalDate,
  formatYear,
  MONTHS,
  toSortKey,
  yearOf,
} from "../historicalDate";
import type { HistoricalDate } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, TOUCH, type } from "../../../theme/tokens";

const ROW = 38;
const VISIBLE = 5;
const PAD = (VISIBLE - 1) / 2;

const FIRST_YEAR = HISTORY.from;
const LAST_YEAR = HISTORY.to;

const clampYear = (year: number) =>
  Math.min(Math.max(year, FIRST_YEAR), LAST_YEAR);

/**
 * Une rangée de roue, qui ne se redessine que si elle change.
 *
 * La roue des années tient 5 100 rangées et en garde plusieurs dizaines
 * montées : chaque cran tourné, chaque chiffre tapé les redessinait toutes,
 * et React Native s'en plaignait (« large list that is slow to update »).
 * Seules deux rangées changent vraiment à chaque fois : celle qu'on quitte et
 * celle où l'on arrive.
 */
const Cell = memo(function Cell({
  label,
  current,
  onPress,
  pressLabel,
}: {
  label: string;
  current: boolean;
  onPress?: () => void;
  pressLabel?: string;
}) {
  const text = (
    <Text style={[styles.cellText, current && styles.cellCurrent]} numberOfLines={1}>
      {label}
    </Text>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pressLabel}
      onPress={onPress}
      style={styles.cell}
    >
      {text}
    </Pressable>
  ) : (
    <View style={styles.cell}>{text}</View>
  );
});

const keyOf = (_: string, position: number) => String(position);

const layoutOf = (_: ArrayLike<string> | null | undefined, position: number) => ({
  length: ROW,
  offset: ROW * position,
  index: position,
});

/** A snapping column. Virtualized, because the year wheel holds 5 100 rows. */
function Wheel({
  data,
  index,
  onIndexChange,
  onPressCurrent,
  currentLabel,
  flex,
}: {
  data: string[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Toucher la rangée choisie, quand cela fait quelque chose. */
  onPressCurrent?: () => void;
  currentLabel?: string;
  flex: number;
}) {
  const ref = useRef<FlatList<string>>(null);

  /**
   * La rangée que la roue montre, telle qu'elle l'a dite.
   *
   * La roue suit aussi ce qui la change du dehors — une année tapée au
   * clavier, le passage du début à la fin, un mois retiré qui emporte son
   * jour. Elle ne lisait que sa première valeur, et restait ensuite où le
   * doigt l'avait laissée, quoi que dise la date.
   */
  const shown = useRef(index);
  useEffect(() => {
    if (index === shown.current) return;
    shown.current = index;
    ref.current?.scrollToOffset({ offset: ROW * index, animated: false });
  }, [index]);

  /**
   * Ne dit que ce qui a changé.
   *
   * iOS signale aussi la fin d'un défilement commandé, et la roue se serait
   * alors annoncée elle-même : à la première année tapée, elle se croyait
   * roulée à la main et refermait le clavier avant le second chiffre.
   */
  const settle = (offset: number) => {
    const at = Math.min(Math.max(Math.round(offset / ROW), 0), data.length - 1);
    if (at === shown.current) return;
    shown.current = at;
    onIndexChange(at);
  };

  /* Lu au moment du toucher plutôt que capturé : le parent recrée sa
     fonction à chaque rendu, et la rangée choisie se redessinerait avec. */
  const press = useRef(onPressCurrent);
  press.current = onPressCurrent;
  const onPress = useCallback(() => press.current?.(), []);
  const pressable = onPressCurrent !== undefined;

  const renderItem = useCallback(
    ({ item, index: position }: { item: string; index: number }) => (
      <Cell
        label={item}
        current={position === index}
        onPress={pressable && position === index ? onPress : undefined}
        pressLabel={currentLabel}
      />
    ),
    [index, pressable, onPress, currentLabel],
  );

  return (
    <View style={{ flex }}>
      <FlatList
        ref={ref}
        data={data}
        extraData={index}
        keyExtractor={keyOf}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        initialScrollIndex={index}
        getItemLayout={layoutOf}
        // Cinq rangées à l'écran : une fenêtre de sept écrans suffit à un
        // lancer vif, là où la valeur par défaut en tenait vingt et un.
        initialNumToRender={VISIBLE * 2}
        maxToRenderPerBatch={VISIBLE * 2}
        windowSize={7}
        contentContainerStyle={{ paddingVertical: ROW * PAD }}
        // A slow drag ends without momentum, so both events have to be heard
        // or the wheel would settle on a row without reporting it.
        onScrollEndDrag={(event) => settle(event.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={(event) =>
          settle(event.nativeEvent.contentOffset.y)
        }
        renderItem={renderItem}
      />
    </View>
  );
}

/**
 * Three wheels and the band that says which row is chosen.
 *
 * Lifted out of the field below so the catalogue's period filter can ask the
 * same question with the same control. Three wheels rather than the system
 * date picker, which cannot express what this app stores: a year on its own
 * ("1299"), a month without a day, or a year before Christ. The dash at the
 * top of the day and month wheels is what keeps an imprecise date imprecise
 * instead of inventing a 1st of January.
 */
export function DateWheels({
  value,
  onChange,
}: {
  value: HistoricalDate;
  onChange: (date: HistoricalDate) => void;
}) {
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

  const yearIndex = clampYear(value.year) - FIRST_YEAR;

  /**
   * L'année tapée plutôt que roulée.
   *
   * Cinq mille rangées, c'est beaucoup de pouce pour aller de 2000 à 487.
   * Toucher l'année ouvre le pavé numérique à sa place. Rien ne s'ajoute à
   * l'écran : le geste se découvre en touchant, comme on le ferait d'une
   * roue d'horloge.
   *
   * Le pavé n'a pas de signe moins : l'année tapée garde l'ère de celle
   * qu'elle remplace, et c'est la roue qui fait passer le zéro.
   *
   * Chaque chiffre est porté aussitôt sur la date, et non à la sortie du
   * champ : « Valider » touché clavier ouvert lirait sinon l'année d'avant.
   */
  const [typed, setTyped] = useState<string | null>(null);
  const beforeChrist = value.year < 0;

  const typeYear = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 4);
    setTyped(digits);
    if (digits === "") return;
    const year = Number(digits);
    onChange({ ...value, year: clampYear(beforeChrist ? -year : year) });
  };

  return (
    <View style={styles.wheels}>
      {/* The centre band shows which row is selected. */}
      <View pointerEvents="none" style={styles.band} />

      <Wheel
        flex={1}
        data={days}
        index={value.day ?? 0}
        onIndexChange={(index) =>
          onChange(
            index === 0 || value.month === undefined
              ? withoutDay(value)
              : { ...value, day: index },
          )
        }
      />
      <Wheel
        flex={1.6}
        data={months}
        index={value.month ?? 0}
        onIndexChange={(index) =>
          // A day cannot outlive its month.
          onChange(index === 0 ? withoutMonth(value) : { ...value, month: index })
        }
      />
      <View style={styles.yearColumn}>
        <Wheel
          flex={1}
          data={years}
          index={yearIndex}
          onIndexChange={(index) => {
            // Rouler pendant qu'on tape : la roue l'emporte, le champ se
            // retire plutôt que d'afficher une année qui n'est plus la bonne.
            setTyped(null);
            onChange({ ...value, year: FIRST_YEAR + index });
          }}
          onPressCurrent={() => setTyped(String(Math.abs(value.year)))}
          currentLabel="Taper l'année"
        />
        {typed !== null ? (
          <TextInput
            autoFocus
            value={typed}
            onChangeText={typeYear}
            onBlur={() => setTyped(null)}
            keyboardType="number-pad"
            // Le pavé numérique d'iOS n'a pas de touche de validation :
            // demander « done » fait poser par React Native une barre
            // au-dessus de lui, et le libellé la met en français. Android a
            // déjà la sienne. Une `InputAccessoryView` à nous ne s'accrochait
            // au champ qu'une fois sur deux : elle le cherche à son propre
            // montage, et le rate s'il n'est pas encore là.
            returnKeyType="done"
            inputAccessoryViewButtonLabel="OK"
            maxLength={4}
            selectTextOnFocus
            accessibilityLabel="Année"
            style={styles.typing}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * La date sur laquelle les roues s'ouvrent quand il n'y en a pas encore.
 *
 * **Le 1er janvier plutôt que « — — »**, et c'est un choix d'accueil, pas de
 * sens : un sélecteur qui ouvre sur deux tirets demande deux gestes avant de
 * dire quoi que ce soit, alors que la plupart des dates qu'on saisit sont
 * complètes.
 *
 * Le « — » reste entier et garde exactement sa signification — « on ne sait
 * pas » —, il suffit de remonter la roue d'un cran. C'est important : une date
 * sans mois s'affiche « 1453 » là où une date au jour s'affiche « 1 janvier
 * 1453 », et cette distinction est une information sur la source, pas un
 * détail de présentation.
 */
const firstDayOf = (year: number): HistoricalDate => ({
  year,
  month: 1,
  day: 1,
});

/**
 * Clearing the day, or the month and the day with it.
 *
 * Written out rather than rebuilt inline, because rebuilding `{ year }` from
 * scratch silently dropped whatever else the date carried — which is exactly
 * how the uncertainty flag would have been lost every time a wheel moved.
 */
const withoutDay = (date: HistoricalDate): HistoricalDate => {
  const { day: _day, ...rest } = date;
  return rest;
};

const withoutMonth = (date: HistoricalDate): HistoricalDate => {
  const { day: _day, month: _month, ...rest } = date;
  return rest;
};

const withoutApproximate = (date: HistoricalDate): HistoricalDate => {
  const { approximate: _approximate, ...rest } = date;
  return rest;
};

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
  const { year: frieze } = useEvents();

  /**
   * Une date encore vide s'ouvre sur l'année de la frise, et non sur
   * aujourd'hui : on crée presque toujours à l'époque qu'on regarde, et
   * partir de 2026 pour un événement de 487 coûtait quinze siècles de roue.
   */
  const blank = () =>
    firstDayOf(frieze === null ? new Date().getFullYear() : yearOf(frieze));

  const [draftStart, setDraftStart] = useState<HistoricalDate>(
    () => start ?? blank(),
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

  const reopen = () => {
    setDraftStart(start ?? blank());
    setDraftEnd(end);
    setEditing("start");
    setOpen(true);
  };

  /**
   * Une période à l'envers, comme la base la refuse (`end_after_start`).
   *
   * Dite sous les roues et non dans une alerte : l'alerte s'ouvrait sous la
   * feuille, invisible, et « Valider » semblait ne rien faire. Le bouton
   * s'éteint, la phrase dit pourquoi, et l'une comme l'autre se défont dès
   * que la roue remet les dates dans l'ordre.
   */
  const backwards =
    draftEnd !== null && toSortKey(draftEnd) < toSortKey(draftStart);

  const confirm = () => {
    if (backwards) return;
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
                ? `${formatDateYear(start)} – ${formatDateYear(end)}`
                : formatDateYear(start)}
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
            <InkButton
              label="Valider"
              variant="solid"
              grow
              disabled={backwards}
              onPress={confirm}
            />
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

          <DateWheels
            value={draft}
            onChange={(next) => setDraft(() => next)}
          />

          <Text style={styles.preview}>
            {draftEnd
              ? `${formatHistoricalDate(draftStart)} → ${formatHistoricalDate(draftEnd)}`
              : formatHistoricalDate(draftStart)}
          </Text>
          {backwards ? (
            <Text style={styles.backwards}>{labels.backwards[1]}</Text>
          ) : null}

          {/* La seconde date avant l'incertitude, et l'ordre dit le rapport
              entre les deux : ajouter une fin décide **de quoi** on parle,
              l'incertitude ne qualifie ensuite que la date sous les molettes.
              Posée au-dessus, elle semblait porter sur l'ensemble. */}
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
                // Sur le début lui-même, précision comprise : une période
                // qui commence « en mars 1453 » doit ouvrir sa fin sur
                // mars, pas retomber sur le 1er janvier. L'incertitude,
                // elle, ne se recopie pas — la fin a la sienne.
                setDraftEnd({
                  year: draftStart.year,
                  ...(draftStart.month === undefined
                    ? {}
                    : { month: draftStart.month }),
                  ...(draftStart.day === undefined
                    ? {}
                    : { day: draftStart.day }),
                });
                setEditing("end");
              }}
              style={({ pressed }) => [styles.add, pressed && styles.pressed]}
            >
              <Text style={styles.addGlyph}>+</Text>
              <Text style={styles.addLabel}>{labels.addEnd}</Text>
            </Pressable>
          )}

          {/* Applies to whichever of the two is under the wheels: one date can
              be attested and the other guessed. */}
          <View style={styles.aboutRow}>
            <View style={styles.aboutText}>
              <Text style={styles.aboutLabel}>Date incertaine</Text>
              <Text style={styles.aboutHint}>
                Elle s'écrira « {ABOUT}
                {formatHistoricalDate({ ...draft, approximate: false })} »
              </Text>
            </View>
            <Switch
              value={draft.approximate === true}
              onValueChange={(approximate) =>
                setDraft((state) =>
                  approximate
                    ? { ...state, approximate: true }
                    : withoutApproximate(state),
                )
              }
              trackColor={{ true: palette.wax, false: palette.line }}
            />
          </View>
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
  yearColumn: { flex: 1.6 },
  // Posé sur la rangée choisie, à sa place exacte : on tape là où on lisait.
  typing: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ROW * PAD,
    height: ROW,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.wax,
    backgroundColor: palette.paper,
    textAlign: "center",
    fontSize: 19,
    fontWeight: "600",
    color: palette.ink,
  },
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
  /**
   * Un peu d'air sous la dernière rangée du panneau.
   *
   * L'écart que la feuille pose entre ses sections sépare deux choses de même
   * nature ; ici, dessous, il y a le pied et ses boutons, qui n'en sont pas
   * une. Le commutateur se retrouvait collé à « Enregistrer », et la rangée
   * paraissait appartenir à la barre plutôt qu'au contenu.
   */
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingBottom: space.md,
  },
  aboutText: { flex: 1, gap: 2 },
  aboutLabel: { fontSize: 15, color: palette.ink, fontWeight: "600" },
  aboutHint: { ...type.caption, color: palette.inkFaint },
  preview: {
    textAlign: "center",
    fontSize: 15,
    letterSpacing: 0.3,
    color: palette.wax,
    fontWeight: "600",
  },
  backwards: { ...type.caption, textAlign: "center", color: palette.danger },
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
