import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { CharacterManager } from "./CharacterManager";
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
import { radius, space, type } from "../../../theme/tokens";
import { useEvents } from "../EventsProvider";

import {
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

/** The five questions, in the order they are asked. */
const STEPS = [
  "Ce qui s'est passé",
  "Quand",
  "Où",
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
type Tab = "event" | "folder" | "character" | "tree";

const FAMILIES = {
  event: [
    { value: "event" as const, label: "Événement" },
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
  location: { longitude: number; latitude: number } | null;
  onRequestPlacement: () => void;
  onCancel: () => void;
  onSaved: () => void;
};

export function EventFormModal({
  visible,
  event,
  family = "event",
  location,
  onRequestPlacement,
  onCancel,
  onSaved,
}: EventFormModalProps) {
  const { folders, characters, addEvent, editEvent } = useEvents();

  /**
   * Which tab of the sheet is showing.
   *
   * Only ever one of the two its family holds — what happened and where it is
   * filed, or who it happened to and how they are related. Editing an
   * existing event has no second tab: there is nothing to add but the changes
   * in front of you.
   */
  const [tab, setTab] = useState<Tab>(
    family === "people" ? "character" : "event",
  );
  /**
   * Which of the five questions is on screen. Only when composing: correcting
   * an event is not a journey, it is one change, and walking a reader through
   * five pages to reach the fourth would be a punishment.
   */
  const [step, setStep] = useState(0);

  /** Composing walks the five questions; correcting shows them all at once. */
  const stepped = !event;
  const show = (index: number) => !stepped || index === step;

  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? "other");
  const [description, setDescription] = useState(event?.description ?? "");
  const [start, setStart] = useState<HistoricalDate | null>(
    event?.start ?? null,
  );
  const [end, setEnd] = useState<HistoricalDate | null>(event?.end ?? null);
  const [links, setLinks] = useState<EventFolderLink[]>(event?.folders ?? []);
  const [cast, setCast] = useState<string[]>(event?.characters ?? []);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<StoredPhoto[]>(
    event?.photos ?? [],
  );
  const [droppedPhotos, setDroppedPhotos] = useState<StoredPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const { say, dialog } = useNotice();

  const reset = () => {
    setTab("event");
    setStep(0);
    setTitle("");
    setType("other");
    setDescription("");
    setStart(null);
    setEnd(null);
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
      visible={visible}
      onClose={onCancel}
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
        tab !== "event" ? (
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
              label={stepped && step > 0 ? "Retour" : "Annuler"}
              variant="tonal"
              grow
              onPress={() => {
                if (stepped && step > 0) {
                  setStep((current) => current - 1);
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

      {stepped && tab === "event" ? <Progress step={step} /> : null}

      {tab === "folder" && !event ? <FolderManager /> : null}
      {tab === "character" && !event ? <CharacterManager /> : null}
      {tab === "tree" && !event ? <TreeManager /> : null}

      <ScrollView
        style={tab !== "event" && !event ? styles.hidden : null}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {show(0) ? (
          <Section title="Ce qui s'est passé" answer={typeName(type)}>
            <InkField
              label="Titre"
              value={title}
              onChangeText={setTitle}
              placeholder="Prise de Constantinople"
            />
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
                onPress={onRequestPlacement}
              />
            </View>
          </Section>
        ) : null}

        {show(3) ? (
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

        {show(4) ? (
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

        {show(5) ? (
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
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
