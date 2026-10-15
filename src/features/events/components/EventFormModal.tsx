import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { LikelyDuplicates } from "../../community/LikelyDuplicates";
import { ShareRow } from "../../community/ShareRow";
import { EVENT_LOOK } from "../../community/looks";
import { CharacterSelector } from "./CharacterSelector";
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
import { usePlacement, type Point } from "../../placement";
import { UpdateRow } from "../../community/UpdateRow";

import {
  type EventDraft,
  type Importance,
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
 *
 * La description et le thème étaient une seule page, « Le détail ». Les
 * séparer tient à ce qu'ils demandent : écrire un paragraphe veut un clavier
 * et toute la place, choisir un thème veut voir seize cases d'un coup. Et le
 * thème est **facultatif**, ce que son titre dit maintenant : un événement
 * sans thème se range sous « Autre », ce qui est une réponse.
 */
const STEPS = [
  "Ce qui s'est passé",
  "Quand",
  "Où",
  "Description",
  "Thème",
  "Qui",
  "Classement",
  "Importance",
  "Images",
] as const;

/**
 * How far along, and how much is left.
 *
 * A wizard without one is a corridor with no windows: the reader cannot tell
 * whether the next tap finishes the job or opens four more pages.
 *
 * Les libellés de `STEPS` ne servent qu'à clé les repères : ce qui se lit à
 * l'écran est « Étape 4 sur 8 » et le titre de la section. Nommer une page se
 * fait donc dans son `Section title`, et non dans la liste.
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

/** L'échelle, telle qu'on la propose — trois crans, et pas de quatrième. */
const IMPORTANCES: { value: Importance; label: string }[] = [
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Élevée" },
];

export type EventFormModalProps = {
  visible: boolean;
  /**
   * The event being edited, if any. The parent gives this modal a `key` tied to
   * it, so switching events remounts the form and the state below re-seeds.
   */
  event?: HistoricalEvent | null;
  /**
   * Demande la fiche de l'entrée que la bibliothèque a corrigée.
   *
   * Seulement depuis `UpdateRow`, en tête du formulaire, et seulement quand il
   * y a du retard à rattraper — c'est-à-dire presque jamais.
   */
  onSeeEntry: (entry: string) => void;
  onCancel: () => void;
  /** Fired once the sheet is off the screen — see `Sheet`. */
  onClosed?: () => void;
  onSaved: () => void;
};

/**
 * Un événement, écrit ou corrigé. Rien d'autre.
 *
 * Cette feuille a longtemps été *la* feuille d'ajout : quatre onglets, puis
 * deux familles de deux, et à l'intérieur une fourche demandant « comment
 * voulez-vous l'ajouter ? ». Elle portait donc trois questions avant la
 * première du formulaire, et il fallait ouvrir un panneau pleine hauteur pour
 * se les entendre poser.
 *
 * Les trois sont remontées au `+`, où elles se posent en deux cartes — voir
 * `NewNoteButton`. Ce qui reste ici est ce qu'une feuille sait faire de mieux :
 * remplir. Les listes de personnages et d'arbres ont leur propre porte,
 * `PeopleSheet`, parce que consulter n'est pas écrire.
 */
export function EventFormModal({
  visible,
  event,
  onSeeEntry,
  onCancel,
  onClosed,
  onSaved,
}: EventFormModalProps) {
  const {
    folderNames,
    characters,
    addEvent,
    editEvent,
    refresh,
    selectEvent,
    share,
  } = useEvents();
  const { aiming, place } = usePlacement();

  /**
   * Which of the questions is on screen. Only when composing: correcting an
   * event is not a journey, it is one change, and walking a reader through
   * five pages to reach the fourth would be a punishment.
   */
  const [step, setStep] = useState(0);

  /** Composing walks the questions; correcting shows them all at once. */
  const stepped = !event;
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
  const [folders, setFolders] = useState<string[]>(event?.folders ?? []);
  const [importance, setImportance] = useState<Importance>(
    event?.importance ?? "medium",
  );
  const [cast, setCast] = useState<string[]>(event?.characters ?? []);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<StoredPhoto[]>(
    event?.photos ?? [],
  );
  const [droppedPhotos, setDroppedPhotos] = useState<StoredPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  /**
   * Whether it is in the community — held here, though it is written at once.
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
    setStep(0);
    setTitle("");
    setType("other");
    setDescription("");
    setStart(null);
    setEnd(null);
    setLocation(null);
    setFolders([]);
    setImportance("medium");
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
      folders,
      importance,
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
      // Seven steps live in here; a panel that resized itself for each would
      // never be still.
      tall
      // Et il monte avec le clavier, comme les feuilles courtes.
      //
      // Il passait `liftsForKeyboard={false}`, au motif qu'un panneau déjà
      // haut de tout l'écran n'a nulle part où monter. C'était faux : le
      // panneau ne monte pas, il **raccourcit** — sa hauteur est un
      // pourcentage de la boîte de contenu, que le rembourrage du clavier
      // réduit — et il se range donc entièrement au-dessus des touches, pied
      // compris. Ce que l'ancien réglage coûtait, c'était les deux boutons :
      // « Annuler » et « Suivant » restaient sous le clavier, au moment précis
      // où l'on finit de taper et où l'on veut passer à la suite.
      title={event ? "Modifier l'événement" : "Nouvel événement"}
      footer={
        <>
          {/* « Retour » remonte d'une question ; à la première il n'y a plus
              rien derrière — la fourche qui s'y trouvait est remontée au `+` —
              donc il dit ce qu'il fait vraiment : annuler. */}
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
      }
    >
      {dialog}

      {stepped ? <Progress step={step} /> : null}

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        // `automaticallyAdjustKeyboardInsets` était posé ici, et il est parti
        // avec le réglage qu'il servait : la marge qu'il pose se mesure sur ce
        // que le clavier recouvre de cette liste, et le panneau se rangeant
        // désormais entièrement au-dessus des touches, elle valait zéro. Il
        // est de toute façon iOS seulement — il ne couvrait donc rien sur
        // Android, où c'est la fenêtre qui se redimensionne.
      >
        {/* En tête du formulaire, et seulement s'il y a du neuf à reprendre.
            C'est l'endroit que le lecteur ouvre pour corriger quelque chose :
            apprendre à ce moment-là que la bibliothèque l'a déjà corrigé lui
            épargne le travail. */}
        {event ? (
          <UpdateRow
            kind="event"
            id={event.id}
            // Vers la fiche de la bibliothèque, où la reprise se demande une
            // fois qu'on a lu ce qu'elle apporte. L'écran baisse cette feuille
            // avant d'ouvrir le catalogue.
            onSee={onSeeEntry}
          />
        ) : null}

        {show(0) ? (
          <Section title="Ce qui s'est passé">
            <InkField
              label="Titre"
              value={title}
              onChangeText={setTitle}
              placeholder="Prise de Constantinople"
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
          <Section title="Description">
            <InkField
              label="Ce que l'on en retient"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Ce que l'on en retient…"
            />
          </Section>
        ) : null}

        {show(4) ? (
          /* La réponse n'est écrite que si le lecteur a choisi : « Autre » est
             la valeur par défaut, et l'afficher ferait passer un champ vide
             pour une réponse donnée. */
          <Section
            title="Thème"
            answer={type === "other" ? undefined : typeName(type)}
          >
            <TypePicker value={type} onChange={setType} />
          </Section>
        ) : null}

        {show(5) ? (
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

        {show(6) ? (
          <Section
            title="Classement"
            answer={
              folders.length === 0
                ? undefined
                : `${folders.length} classeur${folders.length > 1 ? "s" : ""}`
            }
          >
            <Text style={styles.hint}>
              Vous pouvez ranger votre évènement dans un classeur afin de par la suite utiliser ce classeur dans votre filtrage, pour observer uniquement les évènements de votre classeur "Mérovingiens" par exemple.
            </Text>
            <FolderSelector
              known={folderNames}
              value={folders}
              onChange={setFolders}
              allowNew
            />
          </Section>
        ) : null}

        {/* Sur sa propre page, et sans réponse écrite à droite du titre.
            Les deux tenaient dans « Classement » : les sujets, puis une échelle
            sous eux. Ça lisait comme si l'importance appartenait au classeur —
            ce qu'elle a été, par le couple (événement, classeur), et ce qui a
            été démonté précisément parce que personne ne s'en servait. Elle est
            celle de l'événement, donc elle a sa page. */}
        {show(7) ? (
          <Section title="Importance">
            <Text style={styles.hint}>
              L'importance d'un évènement sert également au filtrage, vous pouvez appliquer un filtre sur l'importance pour ne montrer que les évènements que vous avez jugé "Importance élevée" par exemple.
            </Text>
            <SegmentedControl
              segments={IMPORTANCES}
              value={importance}
              onChange={setImportance}
            />
          </Section>
        ) : null}

        {show(8) ? (
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
            is history rather than a diary, so a new event joins the community
            and the reader withdraws it afterwards if they would rather keep
            it — one question fewer on the way in, for the rare answer. */}
        {event ? (
          <View style={styles.sharing}>
            <ShareRow
              what="cet événement"
              shared={shared}
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
  /**
   * Une phrase sous un contrôle, pour dire ce qu'il fait.
   *
   * `type.caption` et non `type.legend` : la légende met en capitales — c'est
   * sa définition — et une phrase entière en capitales ne se lit pas, elle se
   * déchiffre. La légende est pour un mot d'étiquette.
   */
  hint: { ...type.caption, color: palette.inkSoft },

  /** The sections carry their own gutter; this row is not one of them. */
  sharing: { paddingHorizontal: space.xl },

  /* La fourche et ses deux voies vivaient ici. Elles sont parties au `+`, où
     elles précèdent l'ouverture de cette feuille au lieu de l'encombrer —
     voir `NewNoteButton`, qui en a repris les mesures telles quelles. */
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
