import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CharacterManager } from "./CharacterManager";
import { LikelyDuplicates } from "../../community/LikelyDuplicates";
import { whyLocked } from "../../community/copies";
import { ShareRow } from "../../community/ShareRow";
import { EVENT_LOOK } from "../../community/looks";
import { CharacterSelector } from "./CharacterSelector";
import { FolderManager } from "./FolderManager";
import { TreeManager } from "../../genealogy/TreeManager";
import { FolderSelector } from "./FolderSelector";
import { EventDateField } from "./EventDateField";
import { PhotoPicker } from "./PhotoPicker";
import { TypePicker, typeName } from "./TypePicker";
import {
  InkButton,
  InkField,
  SegmentedControl,
  Sheet,
  useNotice,
} from "../../../components/ui";
import { radius, shadow, space, type } from "../../../theme/tokens";
import { useEvents } from "../EventsProvider";
import { usePlacement, type Point } from "../../placement";

import {
  type Character,
  type EventDraft,
  type EventFolderLink,
  type StoredPhoto,
  type EventType,
  type HistoricalDate,
  type HistoricalEvent,
  type PickedPhoto,
} from "../types";
import { palette } from "../../../theme/palette";

/**
 * A heading and, optionally, the current answer beside it.
 *
 * The form used to be a single column of identical grey slabs with a small
 * label over each — nothing told the eye where one question ended and the next
 * began. Four headings turn it into four short questions.
 */
function Section({
  title,
  answer,
  children,
}: {
  title: string;
  answer?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {answer ? <Text style={styles.sectionAnswer}>{answer}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/**
 * The questions, in the order they are asked.
 *
 * The name comes first and the date second **so that the duplicate card can
 * speak before anybody writes a description**. It is the one thing in this
 * form whose position is load-bearing: a title alone cannot tell "Mort de
 * Clotaire" from "Mort de Clotaire II", and by the time a paragraph has been
 * typed it is too late to be told somebody already wrote it.
 *
 * What is required comes first — a name, a date, a place — and everything
 * that elaborates follows.
 */
const STEPS = [
  "Ce qui s'est passé",
  "Quand",
  "Où",
  "Le détail",
  "Qui",
  "Classement",
  "Images",
] as const;

/**
 * How far along, and how much is left.
 *
 * A wizard without one is a corridor with no windows: the reader cannot tell
 * whether the next tap finishes the job or opens four more pages.
 */
function Progress({ step }: { step: number }) {
  const left = STEPS.length - step - 1;

  return (
    <View style={styles.progress}>
      <View style={styles.ticks}>
        {STEPS.map((name, index) => (
          <View
            key={name}
            style={[styles.tick, index <= step && styles.tickDone]}
          />
        ))}
      </View>
      <View style={styles.progressText}>
        <Text style={styles.progressStep}>
          Étape {step + 1} sur {STEPS.length}
        </Text>
        <Text style={styles.progressLeft}>
          {left === 0
            ? "Dernière étape"
            : `${left} étape${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""}`}
        </Text>
      </View>
    </View>
  );
}

/** The four things the sheet can show, in two families of two. */
export type Tab = "event" | "folder" | "character" | "tree";

const FAMILIES = {
  event: [
    { value: "event" as const, label: "Nouvel Événement" },
    { value: "folder" as const, label: "Classeurs" },
  ],
  people: [
    { value: "character" as const, label: "Personnages" },
    { value: "tree" as const, label: "Arbres" },
  ],
} as const;

export type EventFormModalProps = {
  visible: boolean;
  /**
   * The event being edited, if any. The parent gives this modal a `key` tied to
   * it, so switching events remounts the form and the state below re-seeds.
   */
  event?: HistoricalEvent | null;
  /** Which pair of tabs this sheet carries. Ignored when editing. */
  family?: keyof typeof FAMILIES;
  /**
   * Which of the pair to open on, when it is not the first.
   *
   * For coming back: a reader who left this sheet from the Arbres tab should
   * find the Arbres tab, not be handed the one next to it.
   */
  startOn?: Tab;
  /**
   * Asks for someone's page, or the form on them. The screen answers by
   * closing this sheet and opening the panel above it — see
   * `CharacterManager` for why neither can live inside this one.
   */
  onReadCharacter: (person: Character) => void;
  onEditCharacter: (target: Character | "new") => void;
  /** Asks for a tree to be drawn, full screen. */
  onOpenTree: (id: string) => void;
  /** Asks for the community catalogue — of events, of people, of classeurs. */
  onSearch: () => void;
  onSearchPeople: () => void;
  onSearchFolders: () => void;
  onSearchTrees: () => void;
  onCancel: () => void;
  /** Fired once the sheet is off the screen — see `Sheet`. */
  onClosed?: () => void;
  onSaved: () => void;
};

export function EventFormModal({
  visible,
  event,
  family = "event",
  startOn,
  onReadCharacter,
  onEditCharacter,
  onOpenTree,
  onSearch,
  onSearchPeople,
  onSearchFolders,
  onSearchTrees,
  onCancel,
  onClosed,
  onSaved,
}: EventFormModalProps) {
  const {
    folders,
    characters,
    addEvent,
    editEvent,
    refresh,
    selectEvent,
    share,
  } = useEvents();
  const { aiming, place } = usePlacement();

  /**
   * Which tab of the sheet is showing.
   *
   * Only ever one of the two its family holds — what happened and where it is
   * filed, or who it happened to and how they are related. Editing an
   * existing event has no second tab: there is nothing to add but the changes
   * in front of you.
   */
  const [tab, setTab] = useState<Tab>(
    startOn ?? (family === "people" ? "character" : "event"),
  );
  /**
   * Which of the five questions is on screen. Only when composing: correcting
   * an event is not a journey, it is one change, and walking a reader through
   * five pages to reach the fourth would be a punishment.
   */
  const [step, setStep] = useState(0);

  /** Composing walks the questions; correcting shows them all at once. */
  const stepped = !event;
  /**
   * Whether the reader has said which way they are adding an event.
   *
   * There are two, and they were on one screen: a title field to fill in and
   * a link to the chronicle, side by side, which asked the reader to notice
   * the second while already answering the first. Asked plainly instead, and
   * only when composing — correcting an event is not a fork.
   */
  const [writing, setWriting] = useState(false);
  const forking = stepped && tab === "event" && !writing;
  const show = (index: number) => !stepped || index === step;

  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? "other");
  const [description, setDescription] = useState(event?.description ?? "");
  const [start, setStart] = useState<HistoricalDate | null>(
    event?.start ?? null,
  );
  const [end, setEnd] = useState<HistoricalDate | null>(event?.end ?? null);
  const [location, setLocation] = useState<Point | null>(
    event ? { longitude: event.longitude, latitude: event.latitude } : null,
  );
  const [links, setLinks] = useState<EventFolderLink[]>(event?.folders ?? []);
  const [cast, setCast] = useState<string[]>(event?.characters ?? []);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<StoredPhoto[]>(
    event?.photos ?? [],
  );
  const [droppedPhotos, setDroppedPhotos] = useState<StoredPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  /**
   * Whether it is in the chronicle — held here, though it is written at once.
   *
   * Unlike every field above it, this one does not wait for "Enregistrer":
   * `share` is a one-boolean write and that is how the control behaves
   * everywhere else in the app. But the `event` prop is a snapshot taken when
   * the form opened, so it cannot be read back for the tick's position; this
   * remembers what was said instead.
   */
  const [shared, setShared] = useState(event?.shared ?? true);
  const { say, dialog } = useNotice();

  const reset = () => {
    setTab("event");
    setWriting(false);
    setStep(0);
    setTitle("");
    setType("other");
    setDescription("");
    setStart(null);
    setEnd(null);
    setLocation(null);
    setLinks([]);
    setCast([]);
    setPhotos([]);
    setKeptPhotos([]);
    setDroppedPhotos([]);
  };

  /**
   * What is missing at a given step, if anything. Asked on the way out of each
   * one, so a gap is pointed at where it can be filled rather than at the end,
   * four pages away from the field it concerns.
   */
  const missingAt = (index: number): [string, string] | null => {
    if (index === 0 && title.trim() === "")
      return ["Titre manquant", "Un événement a besoin d'un titre."];
    if (index === 1 && !start)
      return ["Date manquante", "Choisissez au moins une année."];
    if (index === 2 && !location)
      return ["Lieu manquant", "Placez l'événement sur la carte."];
    return null;
  };

  const next = () => {
    const missing = missingAt(step);
    if (missing) {
      say(missing[0], missing[1]);
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const save = async () => {
    for (let index = 0; index < STEPS.length; index++) {
      const missing = missingAt(index);
      if (missing) {
        say(missing[0], missing[1]);
        if (stepped) setStep(index);
        return;
      }
    }
    if (!start || !location) return;

    const draft: EventDraft = {
      title,
      type,
      description,
      start,
      end,
      longitude: location.longitude,
      latitude: location.latitude,
      folders: links,
      characters: cast,
      photos,
    };

    setSaving(true);
    try {
      if (event) {
        await editEvent(event.id, draft, keptPhotos, droppedPhotos);
      } else {
        await addEvent(draft);
        reset();
      }
      onSaved();
    } catch (cause) {
      say(
        "Enregistrement impossible",
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      // Hidden, not unmounted, while the reader aims at the map: the answers
      // to the other five questions are held here and must survive the trip.
      visible={visible && !aiming}
      onClose={onCancel}
      // Not while it is merely standing aside for the reticle.
      onClosed={aiming ? undefined : onClosed}
      // Six steps and two lists live in here; a panel that resized itself for
      // each would never be still.
      tall
      // And a panel already the height of the screen has nowhere to rise to:
      // the keyboard simply covers its foot, and the scrolling content below
      // brings whatever is being typed into view.
      liftsForKeyboard={false}
      title={
        event
          ? "Modifier l'événement"
          : family === "people"
            ? "Personnages"
            : "Événements"
      }
      footer={
        // A folder is written the moment it is named, so that half of the
        // sheet has nothing to save and nothing to cancel.
        // Nothing at the foot of the fork: it asks a question with two
        // answers on the screen, and a third at the bottom saying "neither"
        // is furniture. The panel already closes by the handle and by the
        // paper around it.
        forking ? undefined : tab !== "event" ? (
          <InkButton
            label="Fermer"
            variant="tonal"
            grow
            onPress={() => {
              reset();
              onCancel();
            }}
          />
        ) : (
          <>
            <InkButton
              label={stepped ? "Retour" : "Annuler"}
              variant="tonal"
              grow
              onPress={() => {
                if (stepped && step > 0) {
                  setStep((current) => current - 1);
                  return;
                }
                // Back out of the first question to the fork, not off the
                // screen: the reader may have meant the other way in.
                if (stepped) {
                  setWriting(false);
                  return;
                }
                reset();
                onCancel();
              }}
            />
            {stepped && step < STEPS.length - 1 ? (
              <InkButton label="Suivant" variant="solid" grow onPress={next} />
            ) : (
              <InkButton
                label={saving ? "Enregistrement…" : "Enregistrer"}
                variant="solid"
                grow
                disabled={saving}
                onPress={() => void save()}
              />
            )}
          </>
        )
      }
    >
      {dialog}

      {event ? null : (
        <View style={styles.switcher}>
          <SegmentedControl
            segments={[...FAMILIES[family]]}
            value={tab}
            onChange={setTab}
          />
        </View>
      )}

      {forking ? (
        <View style={styles.fork}>
          <Text style={styles.forkAsk}>Comment voulez-vous l'ajouter ?</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Écrire un événement"
            onPress={() => setWriting(true)}
            style={({ pressed }) => [styles.way, pressed && styles.wayDown]}
          >
            <View style={styles.quill}>
              <Text style={styles.quillGlyph}>✎</Text>
            </View>
            <View style={styles.wayText}>
              <Text style={styles.wayTitle}>Écrire un événement</Text>
              <Text style={styles.wayDetail}>
                Le vôtre, de la première ligne à la dernière.
              </Text>
            </View>
            <Text style={styles.wayMore}>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chercher dans la chronique commune"
            onPress={onSearch}
            style={({ pressed }) => [
              styles.way,
              styles.waySeek,
              pressed && styles.wayDown,
            ]}
          >
            {/* A lens, drawn — the same one the people's list wears. */}
            <View style={styles.quill}>
              <View style={styles.lensGlass} />
              <View style={styles.lensHandle} />
            </View>
            <View style={styles.wayText}>
              <Text style={[styles.wayTitle, styles.waxed]}>
                Chercher dans la chronique commune
              </Text>
              <Text style={styles.wayDetail}>
                Ce que les autres ont déjà écrit, à prendre chez vous.
              </Text>
            </View>
            <Text style={[styles.wayMore, styles.waxed]}>›</Text>
          </Pressable>
        </View>
      ) : null}

      {stepped && tab === "event" && writing ? <Progress step={step} /> : null}

      {tab === "folder" && !event ? (
        <FolderManager onSeek={onSearchFolders} />
      ) : null}
      {tab === "character" && !event ? (
        <CharacterManager
          onRead={onReadCharacter}
          onEdit={onEditCharacter}
          onSeek={onSearchPeople}
        />
      ) : null}
      {tab === "tree" && !event ? (
        <TreeManager onOpen={onOpenTree} onSeek={onSearchTrees} />
      ) : null}

      <ScrollView
        style={
          (tab !== "event" && !event) || forking ? styles.hidden : styles.fill
        }
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        // What replaces lifting the panel: the list makes room underneath
        // itself for the keys, so a focused field is never behind them.
        automaticallyAdjustKeyboardInsets
      >
        {show(0) ? (
          <Section title="Ce qui s'est passé">
            <InkField
              label="Titre"
              value={title}
              onChangeText={setTitle}
              placeholder="Prise de Constantinople"
            />
            <Text style={styles.hint}>
              Le nom d'abord, la date ensuite : si quelqu'un l'a déjà écrit,
              autant le savoir avant d'en écrire le récit.
            </Text>
          </Section>
        ) : null}

        {show(1) ? (
          <Section title="Quand">
            {/* One control, and the question of whether it lasted is asked
                inside it — where the answer is given. */}
            <EventDateField
              start={start}
              end={end}
              onChange={(nextStart, nextEnd) => {
                setStart(nextStart);
                setEnd(nextEnd);
              }}
            />

            {/* Here rather than under the title, and the reason is measured:
                see `LikelyDuplicates`. Only while composing — correcting an
                event that already exists is not the moment to be told that
                it resembles itself. */}
            {stepped ? (
              <LikelyDuplicates
                kind="event"
                look={EVENT_LOOK}
                noun="événement"
                title={title}
                year={start?.year ?? null}
                approximate={start?.approximate === true}
                onTaken={(made) => {
                  // The collection first, then the map: selecting an event
                  // it does not hold yet would find nothing. And no notice —
                  // one rendered inside this sheet would leave with it. The
                  // event flying under the reader's eye says it better.
                  void refresh().then(() => {
                    selectEvent(made);
                    reset();
                    onSaved();
                  });
                }}
              />
            ) : null}
          </Section>
        ) : null}

        {show(2) ? (
          <Section title="Où">
            <View style={styles.location}>
              <View style={styles.locationText}>
                <Text style={styles.legend}>Lieu</Text>
                <Text style={styles.coordinates}>
                  {location
                    ? `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`
                    : "Non défini"}
                </Text>
              </View>
              <InkButton
                label={location ? "Déplacer" : "Placer"}
                variant={location ? "tonal" : "solid"}
                onPress={() => {
                  void place().then((point) => {
                    // Backing out must not unplace what was already placed.
                    if (point) setLocation(point);
                  });
                }}
              />
            </View>
          </Section>
        ) : null}

        {show(3) ? (
          <Section title="Le détail" answer={typeName(type)}>
            <TypePicker value={type} onChange={setType} />
            <InkField
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Ce que l'on en retient…"
            />
          </Section>
        ) : null}

        {show(4) ? (
          <Section
            title="Qui"
            answer={
              cast.length === 0
                ? undefined
                : `${cast.length} personnage${cast.length > 1 ? "s" : ""}`
            }
          >
            <CharacterSelector
              characters={characters}
              value={cast}
              onChange={setCast}
            />
          </Section>
        ) : null}

        {show(5) ? (
          <Section
            title="Classement"
            answer={
              links.length === 0
                ? undefined
                : `${links.length} classeur${links.length > 1 ? "s" : ""}`
            }
          >
            <FolderSelector
              folders={folders}
              value={links}
              // Without "Toutes" on offer the control cannot hand back a null,
              // but the type says it might; the fallback states the invariant
              // rather than asserting it away.
              onChange={(next) =>
                setLinks(
                  next.map((link) => ({
                    folderId: link.folderId,
                    importance: link.importance ?? "medium",
                  })),
                )
              }
            />
          </Section>
        ) : null}

        {show(6) ? (
          <Section title="Images">
            <PhotoPicker
              photos={photos}
              onChange={setPhotos}
              existing={keptPhotos}
              onChangeExisting={setKeptPhotos}
              onRemoveExisting={(photo) => {
                setKeptPhotos((current) =>
                  current.filter((kept) => kept.id !== photo.id),
                );
                setDroppedPhotos((current) => [...current, photo]);
              }}
            />
          </Section>
        ) : null}

        {/* Only when correcting. Composing never asks: what is written here
            is history rather than a diary, so a new event joins the chronicle
            and the reader withdraws it afterwards if they would rather keep
            it — one question fewer on the way in, for the rare answer. */}
        {event ? (
          <View style={styles.sharing}>
            <ShareRow
              what="cet événement"
              shared={shared}
              locked={whyLocked(event.origin)}
              onChange={async (next) => {
                await share("event", event.id, next);
                setShared(next);
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { ...type.legend, color: palette.inkFaint },

  /** The sections carry their own gutter; this row is not one of them. */
  sharing: { paddingHorizontal: space.xl },

  /**
   * The two ways in, asked before either is taken.
   *
   * They were one screen — a title to type and a link to the chronicle
   * beside it — which is a fork drawn as a form: it asked the reader to
   * notice the second option while already answering the first. Two cards
   * ask the question instead, and the answer decides what comes next.
   */
  fork: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.md },
  forkAsk: { ...type.caption, color: palette.inkSoft, textAlign: "center" },
  way: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: palette.paperLight,
    borderWidth: 1.5,
    borderColor: palette.paperDeep,
    ...shadow.soft,
  },
  /** The second leans, and is edged in wax: it leads somewhere else. */
  waySeek: { borderColor: palette.wax, transform: [{ rotate: "-0.6deg" }] },
  wayDown: { opacity: 0.6 },
  quill: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  quillGlyph: { fontSize: 22, color: palette.inkSoft },
  lensGlass: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: palette.wax,
  },
  lensHandle: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 9,
    height: 2.5,
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
    transform: [{ rotate: "45deg" }],
  },
  wayText: { flex: 1, gap: 2 },
  wayTitle: { fontSize: 15.5, fontWeight: "700", color: palette.ink },
  wayDetail: { ...type.legend, color: palette.inkSoft },
  wayMore: { fontSize: 20, lineHeight: 22, color: palette.inkFaint },
  waxed: { color: palette.wax },
  switcher: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
  },
  progress: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.sm,
  },
  ticks: { flexDirection: "row", gap: 4 },
  tick: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.sunken,
  },
  tickDone: { backgroundColor: palette.wax },
  progressText: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.sm,
  },
  progressStep: { ...type.caption, color: palette.inkSoft, fontWeight: "600" },
  progressLeft: { ...type.caption, color: palette.inkFaint },
  hidden: { display: "none" },
  /** The panel has a height of its own now; its contents must take it up. */
  fill: { flex: 1 },
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xxl,
  },
  section: { gap: space.md },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.sm,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: palette.ink },
  sectionAnswer: { ...type.caption, color: palette.wax, fontWeight: "600" },
  location: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  locationText: { flex: 1, gap: space.xs },
  legend: { ...type.legend, color: palette.inkSoft },
  coordinates: { fontSize: 15, color: palette.ink, fontWeight: "500" },
});
