import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import * as api from "./api";
import { LOOKS } from "./looks";
import { SharedCard } from "./SharedCard";
import { windowed } from "./trail";
import { ThingRow } from "./ThingRow";
import {
  ANYTHING,
  REASONS,
  type Blocked,
  type Cursor,
  type Kind,
  type Look,
  type Ordering,
  type Reason,
  type Search,
  type SharedThing,
} from "./types";
import {
  Chip,
  InkButton,
  InkField,
  Sheet,
  useNotice,
} from "../../components/ui";
import { DateWheels } from "../events/components/EventDateField";
import { TreePreview } from "../genealogy/TreePreview";
import type { Face } from "../genealogy/TreeFace";
import type { Tree } from "../events/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useEvents } from "../events/EventsProvider";
import { useHidden } from "../territories/HiddenProvider";
import { formatHistoricalDate } from "../events/historicalDate";
import { widthsFor } from "./period";
import { usePlacement } from "../placement";
import { ANSWER_WITHIN, CONTACT } from "../../config/contact";
import { palette } from "../../theme/palette";
import { BACKDROP, radius, shadow, space, type } from "../../theme/tokens";

/** Where a rising card starts from: below the panel, whatever its height. */
const OFFSCREEN = Dimensions.get("window").height;

const SORTS: {
  value: Ordering;
  label: string;
  /** Said on the button, where there is room for one word. */
  said: string;
  /** And why one would want it, on the card where there is room to say. */
  why: string;
  mark: string;
}[] = [
  {
    value: "stars",
    label: "Les plus copiés",
    said: "étoiles",
    why: "Ce que d'autres lecteurs ont trouvé bon à garder.",
    mark: "★",
  },
  {
    value: "recent",
    label: "Les plus récents",
    said: "récents",
    why: "Ce qui vient d'être écrit, copié ou non.",
    mark: "◷",
  },
];

export type CatalogueProps = {
  kind: Kind;
  look: Look;
  visible: boolean;
  onClose: () => void;
  /** Fired once the panel is off the screen — see `Sheet`. */
  onClosed?: () => void;
};

/**
 * What everybody else has written, and a way to take some of it.
 *
 * The catalogue is not the collection and is deliberately not drawn like it:
 * every line carries a name that is not yours and a count of how many readers
 * found it worth keeping. Those two are the whole difference between a list
 * of things and a history written by many hands.
 *
 * Two faces rather than two panels — the list, and one event read whole.
 * iOS will not present a sheet from a sheet that is already presenting one,
 * and the app has settled on turning a card over instead of stacking cards.
 *
 * The filters lean on what the reader is already doing: "cette époque" is the
 * century the frieze has come to rest on, "cette région" is what the plate is
 * centred over. A form asking for four numbers would be answered by nobody.
 */
export function Catalogue({
  kind,
  look,
  visible,
  onClose,
  onClosed,
}: CatalogueProps) {
  const { year, refresh } = useEvents();
  const { reload: reloadDrawn } = useHidden();
  const { aiming, placeRegion, showShape, looking } = usePlacement();
  const insets = useSafeAreaInsets();
  const { say, dialog } = useNotice();

  const [search, setSearch] = useState<Search>(ANYTHING);
  const [rows, setRows] = useState<SharedThing[]>([]);
  const [loading, setLoading] = useState(false);
  const [drained, setDrained] = useState(false);
  /**
   * What is being read, and what it was reached from.
   *
   * A stack rather than one thing, because a classeur's card lists its
   * events and those have to be openable — nobody takes twenty-seven events
   * on the strength of their titles. "Retour" then means one step back to
   * the classeur, not all the way out to the list.
   */
  const [trail, setTrail] = useState<{ kind: Kind; thing: SharedThing }[]>([]);
  const reading = trail[trail.length - 1] ?? null;
  /** Drawn as the thing it is, not as the thing that held it. */
  const readingLook = reading === null ? look : LOOKS[reading.kind];

  /**
   * How far off the bottom the card being read is.
   *
   * It rises on every step deeper — the list to a classeur, the classeur to
   * one of its events — because that is what the gesture said: something has
   * come forward. Going back sends it down and only then pops the trail, so
   * the card is seen leaving rather than blinking out.
   */
  const rise = useRef(new Animated.Value(OFFSCREEN)).current;
  /**
   * True while a card is on its way down.
   *
   * The buttons at the foot belong to whatever the reader is arriving at,
   * not to what is still leaving: waiting for the slide to end made them
   * change once the card had already gone. Told at the moment "Retour" is
   * pressed, they change with the gesture and the card finishes travelling
   * under them.
   */
  const [descending, setDescending] = useState(false);

  /**
   * Whether the buttons at the foot belong to a card.
   *
   * On the way down it looks at where the step lands: back out of an event
   * opened inside a classeur returns to the classeur, so they stay the
   * card's; back out of the last one returns to the list, so "Fermer" comes
   * back — with the gesture, not after the slide.
   */
  const atCard = descending ? trail.length > 1 : trail.length > 0;

  const rose = useRef(0);
  /**
   * Laid out before the frame is drawn, not after it.
   *
   * As a passive effect this ran *after* the new card had been committed, so
   * one frame showed it sitting at its final position before it jumped
   * offscreen and sprang back up. That flash was always there and was always
   * invisible: the card used to carry the previous thing's body, so the
   * flashed frame looked exactly like the card already on screen. Mounting a
   * fresh card per step made it flash an empty one instead, which is the
   * stutter a reader notices. A layout effect puts the starting position in
   * the same commit as the card.
   */
  useLayoutEffect(() => {
    if (trail.length === 0) {
      rose.current = 0;
      return;
    }
    // Only a step deeper travels. Coming back to a classeur from one of its
    // events, the classeur is already there and should not be thrown down
    // and hauled up again.
    const deeper = trail.length > rose.current;
    rose.current = trail.length;
    if (!deeper) {
      // Back at rest, and this is load-bearing now that the trail stays
      // mounted: the card that just left was carrying `rise` at OFFSCREEN,
      // and the parent inherits that transform the moment it becomes the top
      // of the stack. Put back in the same commit as the pop, so the parent
      // is never painted off the bottom of the screen.
      rise.setValue(0);
      return;
    }
    rise.setValue(OFFSCREEN);
    Animated.spring(rise, {
      toValue: 0,
      damping: 26,
      stiffness: 240,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [trail.length, rise]);

  /**
   * One step back: the top card leaves, and what it came from is revealed.
   *
   * Nothing is rebuilt. The parent has been mounted underneath the whole
   * time, with what it read and where it was scrolled, so this is a card
   * sliding off something rather than a card being replaced. Popping only
   * after the slide is what keeps it on screen while it travels; the layout
   * effect above puts `rise` back for whoever becomes the top.
   */
  const back = () => {
    if (descending) return;
    setDescending(true);
    Animated.timing(rise, {
      toValue: OFFSCREEN,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      setDescending(false);
      if (finished) setTrail((was) => was.slice(0, -1));
    });
  };
  const [taking, setTaking] = useState<string | null>(null);
  /**
   * Which of the four faces is up.
   *
   * Faces and not panels: a sheet cannot present a sheet, and turning a card
   * over is what the rest of the app does with the same problem.
   */
  const [face, setFace] = useState<"list" | "report" | "blocked">("list");
  /**
   * Which setting is open over the panel, if either.
   *
   * A card laid on the sheet rather than a face of it: two choices and a pair
   * of wheels do not deserve the whole screen, and the list underneath is
   * what the settings are about — seeing it behind them is the point.
   *
   * Drawn **inside** the sheet and not as a modal of its own, which is the
   * whole reason it can exist: the region filter sends the reader to the map,
   * and a modal presented over this panel would be dismissed along with it —
   * that is the freeze the tree cost us.
   */
  const [sifting, setSifting] = useState<"sort" | "filters" | null>(null);
  /**
   * A genealogy being looked at, drawn over the panel.
   *
   * Not a card and not the map: a lineage of forty across six generations
   * needs room, and the sheet is already most of the screen. Fetched on the
   * tap rather than carried in the row — unlike a territory's outline, a
   * whole tree is too much to send for every line of a list.
   */
  const [drawn, setDrawn] = useState<{
    thing: SharedThing;
    tree: Tree;
    faces: Map<string, Face>;
  } | null>(null);
  /**
   * Whether the era's wheels are out.
   *
   * Closed, the row says one thing: "Toute l'histoire", or the period that
   * was set. A date and the words "toute l'histoire" on screen at once
   * contradict each other, which is what this replaced.
   */
  const [tuning, setTuning] = useState(false);
  const [why, setWhy] = useState<Reason>("offensive");
  const [said, setSaid] = useState("");
  const [blocked, setBlocked] = useState<Blocked[]>([]);

  /**
   * Which request is the current one.
   *
   * Typing fires a search per keystroke's worth of pause, and the answers do
   * not come back in the order they were asked. Without this, a slow early
   * page can land after a fast later one and show the wrong list.
   */
  const asked = useRef(0);

  const fetchPage = useCallback(
    async (from: Cursor) => {
      const mine = ++asked.current;
      setLoading(true);
      try {
        const page = await api.search(kind, search, from);
        if (asked.current !== mine) return;
        setRows((current) => (from === null ? page : [...current, ...page]));
        setDrained(page.length < api.PAGE);
      } catch (cause) {
        if (asked.current !== mine) return;
        say(
          "Recherche impossible",
          cause instanceof Error ? cause.message : String(cause),
        );
      } finally {
        if (asked.current === mine) setLoading(false);
      }
    },
    // `say` is rebuilt on every render; following it would search endlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, search],
  );

  // A pause before asking: a search per keystroke is a search per keystroke.
  useEffect(() => {
    if (!visible) return;
    const waiting = setTimeout(() => void fetchPage(null), 250);
    return () => clearTimeout(waiting);
  }, [visible, fetchPage]);

  /** Who this reader has put out of sight, read when the face opens. */
  const listBlocked = () => {
    void api
      .blockedPeople()
      .then(setBlocked)
      .catch(() => setBlocked([]));
  };
  useEffect(() => {
    if (visible) listBlocked();
  }, [visible]);

  /**
   * The two filters open on what the reader is already looking at.
   *
   * Seeded rather than fixed: the field shows the year of the frieze and the
   * point the plate is centred over, and both can then be moved. Nothing is
   * narrowed until a width is chosen, so seeding changes no results.
   */
  useEffect(() => {
    if (!visible) return;
    setSearch((was) => ({
      ...was,
      at: was.at ?? (year === null ? null : { year: Math.trunc(year) }),
      near: was.near ?? looking.current,
    }));
    // Once, on opening: following the frieze would move the filter under the
    // reader while they were setting it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const report = () => {
    const one = reading?.thing;
    if (!one) return;
    setTaking(one.id);
    void api
      .report(reading.kind, one.id, why, said)
      .then(() => {
        setRows((current) =>
          current.map((row) =>
            row.id === one.id ? { ...row, reported: true } : row,
          ),
        );
        setTrail((was) =>
          was.map((step) =>
            step.thing.id === one.id
              ? { ...step, thing: { ...step.thing, reported: true } }
              : step,
          ),
        );
        setFace("list");
        setSaid("");
        say(
          "Signalement envoyé",
          `Nous le regardons sous ${ANSWER_WITHIN}. Vous pouvez aussi nous écrire à ${CONTACT}.`,
        );
      })
      .catch((cause: unknown) =>
        say(
          "Signalement impossible",
          cause instanceof Error ? cause.message : String(cause),
        ),
      )
      .finally(() => setTaking(null));
  };

  const block = () => {
    const one = reading?.thing;
    if (!one) return;
    setTaking(one.id);
    void api
      .blockAuthorOf(reading.kind, one.id)
      .then(() => {
        setTrail([]);
        listBlocked();
        void fetchPage(null);
        say(
          "Auteur bloqué",
          `Vous ne verrez plus rien de ${one.author}, et cette personne ne verra plus rien de vous.`,
        );
      })
      .catch((cause: unknown) =>
        say(
          "Blocage impossible",
          cause instanceof Error ? cause.message : String(cause),
        ),
      )
      .finally(() => setTaking(null));
  };

  /**
   * How many of the two filters are doing something, for the button.
   *
   * **Both halves, for both filters.** A point alone narrows nothing — the
   * query sends `within_m: null` without a radius, exactly as it sends no
   * era without a width — and the panel opens with a point already seeded on
   * whatever the plate is centred over. Testing `near` alone therefore lit
   * the Filtres chip and counted « 1 » on every single opening, over a row
   * that read « Partout ». The seeding effect's own comment promises that
   * nothing is narrowed until a width is chosen; this is what keeps it.
   */
  const era = search.span !== null && search.at !== null;
  const region = search.near !== null && search.withinMetres !== null;
  const narrowed = (era ? 1 : 0) + (region ? 1 : 0);
  /** The date in the wheels, which stand on today when nothing was said. */
  const when = search.at ?? { year: new Date().getFullYear() };
  /** And the width, named — "± 1 semaine" — for the closed row. */
  const spanSaid =
    widthsFor(when).find((one) => one.years === search.span)?.label ?? "";

  /** Puts the two settings away, wheels included. */
  const close = () => {
    setSifting(null);
    setTuning(false);
  };

  /**
   * Lays a row's shape on the plate, and takes it if the reader says so.
   *
   * For the kinds whose whole substance is a shape: the card is skipped
   * because it has nothing to add, and copying from the map saves the trip
   * back for a second decision.
   */
  /**
   * Opens a genealogy over the panel, once it has been fetched.
   *
   * The payload arrives flat — members, lines, faces — and is assembled into
   * the shape the canvas draws, which is the same shape the builder draws.
   */
  const openDrawing = (one: SharedThing) => {
    setTaking(one.id);
    void api
      .fetchWhole("tree", one.id)
      .then((whole) => {
        if (whole?.drawing == null) return;
        setDrawn({
          thing: one,
          tree: {
            id: one.id,
            name: one.title,
            note: null,
            shared: true,
            origin: null,
            members: whole.drawing.members.map((m) => ({
              id: m.id,
              characterId: m.characterId,
              generation: m.generation,
              position: m.position,
              importance: m.importance,
              note: null,
            })),
            links: whole.drawing.links,
          },
          faces: new Map(
            whole.drawing.people.map((who) => [
              who.id,
              {
                name: who.name,
                photo: who.photo,
                dates: who.dates,
                tint: who.tint,
              },
            ]),
          ),
        });
      })
      .catch((cause: unknown) =>
        say(
          "Arbre illisible",
          cause instanceof Error ? cause.message : String(cause),
        ),
      )
      .finally(() => setTaking(null));
  };

  const onTheMap = (one: SharedThing) => {
    if (kind === "tree") {
      openDrawing(one);
      return;
    }
    if (one.shape === undefined) return;
    void showShape(one.shape, {
      name: one.title,
      said: look.under(one),
      take: look.take,
      takeable: !one.mine && !one.copied,
    }).then((taken) => {
      if (taken) takeIt(one);
    });
  };

  const takeIt = (one: SharedThing, its: Kind = kind) => {
    setTaking(one.id);
    void api
      .copy(its, one.id)
      .then(async () => {
        // Two stores hold what this account owns, and a copy arrives by a
        // route neither knows about: the collection for events, people and
        // classeurs, the painted territories for the rest. The map redraws
        // itself from the database and needed no telling; these lists are
        // held in memory and did.
        await (its === "territory" ? reloadDrawn() : refresh());
        // The drawing has served its purpose once the copy is taken.
        setDrawn(null);
        setRows((current) =>
          current.map((row) =>
            row.id === one.id
              ? { ...row, copied: true, stars: row.stars + 1 }
              : row,
          ),
        );
        setTrail((was) =>
          was.map((step) =>
            step.thing.id === one.id
              ? {
                  ...step,
                  thing: {
                    ...step.thing,
                    copied: true,
                    stars: step.thing.stars + 1,
                  },
                }
              : step,
          ),
        );
      })
      .catch((cause: unknown) =>
        say(
          "Copie impossible",
          cause instanceof Error ? cause.message : String(cause),
        ),
      )
      .finally(() => setTaking(null));
  };

  return (
    <Sheet
      // Out of the way while the reader aims at the map — the region filter
      // asks for a point the same way everything else in this app does — and
      // back afterwards with the sieve exactly as they left it.
      visible={visible && !aiming}
      onClose={onClose}
      onClosed={aiming ? undefined : onClosed}
      tall
      liftsForKeyboard={false}
      /**
       * The heading never changes while a card is read, and that is the
       * point.
       *
       * It used to name the thing — "Un classeur" over a classeur — which
       * said nothing the card does not say better with its own name three
       * lines down. Taking it away instead made the opening two events: the
       * title vanished, then the card rose into the gap. Left alone, it is
       * simply the name of the catalogue one is in, the card slides up
       * beneath it, and nothing flickers.
       */
      title={
        face === "report"
          ? "Signaler"
          : face === "blocked"
            ? "Personnes bloquées"
            : look.many
      }
      footer={
        face === "report" ? (
          <>
            <InkButton
              label="Annuler"
              variant="tonal"
              grow
              onPress={() => setFace("list")}
            />
            <InkButton
              label={taking === null ? "Envoyer" : "…"}
              variant="solid"
              tone="danger"
              grow
              disabled={taking !== null}
              onPress={report}
            />
          </>
        ) : face === "blocked" ? (
          <InkButton
            label="Retour"
            variant="tonal"
            grow
            onPress={() => setFace("list")}
          />
        ) : !atCard || reading === null ? (
          <InkButton label="Fermer" variant="tonal" grow onPress={onClose} />
        ) : (
          /* The card slides; the chrome around it does not. Putting these
             inside the sliding panel made them travel with it, which was
             prettier — and left the sheet's own footer showing underneath,
             two rows of buttons at once. */
          <>
            {/* Not `grow`: six letters claiming half the footer left the
                other button 121pt of room, and "Copier le personnage" needs
                156. "Retour" takes what it needs and the copy button, whose
                label is the long one and the one that matters, takes the
                rest. */}
            <InkButton label="Retour" variant="tonal" onPress={back} />
            <InkButton
              label={
                reading.thing.mine
                  ? "Le vôtre"
                  : reading.thing.copied
                    ? "Déjà copié"
                    : taking === reading.thing.id
                      ? "Copie…"
                      : // `readingLook`, not `look`: the foot belongs to the
                        // card in front of it, which may be two kinds away
                        // from the list that was searched.
                        readingLook.take
              }
              variant="solid"
              grow
              disabled={
                reading.thing.mine || reading.thing.copied || taking !== null
              }
              onPress={() => takeIt(reading.thing, reading.kind)}
            />
          </>
        )
      }
    >
      {dialog}

      {face === "report" ? (
        <ScrollView contentContainerStyle={styles.reading}>
          <Text style={styles.lead}>
            Dites-nous ce qui ne va pas avec « {reading?.thing.title} ». Son
            auteur n'en saura rien. Assez de signalements et la chose est retirée
            de la communauté en attendant d'être relue.
          </Text>

          {REASONS.map((one) => (
            <Pressable
              key={one.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: why === one.value }}
              onPress={() => setWhy(one.value)}
              style={({ pressed }) => [
                styles.reason,
                why === one.value && styles.reasonOn,
                pressed && styles.dim,
              ]}
            >
              <Text
                style={[
                  styles.reasonLabel,
                  why === one.value && styles.reasonLabelOn,
                ]}
              >
                {one.label}
              </Text>
            </Pressable>
          ))}

          <InkField
            label="À préciser (facultatif)"
            value={said}
            onChangeText={setSaid}
            multiline
            maxLength={600}
            placeholder="Ce qui vous a fait le signaler…"
          />

          <Text style={styles.aside}>
            Nous répondons sous {ANSWER_WITHIN}. Vous pouvez aussi écrire à{" "}
            {CONTACT}.
          </Text>
        </ScrollView>
      ) : face === "blocked" ? (
        <ScrollView contentContainerStyle={styles.reading}>
          {blocked.length === 0 ? (
            <Text style={styles.lead}>
              Vous n'avez bloqué personne. Bloquer quelqu'un retire son travail
              de ce que vous voyez, et le vôtre de ce qu'il voit.
            </Text>
          ) : (
            blocked.map((one) => (
              <View key={one.id} style={styles.blocked}>
                <Text style={styles.blockedName}>{one.handle}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Débloquer ${one.handle}`}
                  hitSlop={8}
                  onPress={() => {
                    void api
                      .unblock(one.id)
                      .then(() => {
                        listBlocked();
                        void fetchPage(null);
                      })
                      .catch(() => undefined);
                  }}
                  style={({ pressed }) => [
                    styles.unblock,
                    pressed && styles.dim,
                  ]}
                >
                  <Text style={styles.unblockLabel}>Débloquer</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <>
          <View style={styles.stack}>
            <View style={styles.sieve}>
              {/* `look`, non `readingLook` : le champ interroge la liste
                  qu'on parcourt, pas la fiche qu'on lit par-dessus. */}
              <InkField
                label={look.named}
                value={search.words}
                onChangeText={(words) =>
                  setSearch((was) => ({ ...was, words }))
                }
                placeholder={look.hint}
                autoCorrect={false}
                returnKeyType="search"
              />

              {/* Two buttons rather than every control at once: the sieve is
                three questions deep and only the name is asked often. */}
              <View style={styles.tools}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Trier"
                  onPress={() => setSifting("sort")}
                  style={({ pressed }) => [styles.tool, pressed && styles.dim]}
                >
                  <Text style={styles.toolLabel}>
                    Tri · {SORTS.find((one) => one.value === search.sort)?.said}
                  </Text>
                  <Text style={styles.toolMore}>⌄</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Filtrer"
                  onPress={() => setSifting("filters")}
                  style={({ pressed }) => [
                    styles.tool,
                    narrowed > 0 && styles.toolOn,
                    pressed && styles.dim,
                  ]}
                >
                  <Text
                    style={[
                      styles.toolLabel,
                      narrowed > 0 && styles.toolLabelOn,
                    ]}
                  >
                    {narrowed === 0 ? "Filtres" : `Filtres · ${narrowed}`}
                  </Text>
                  <Text
                    style={[
                      styles.toolMore,
                      narrowed > 0 && styles.toolLabelOn,
                    ]}
                  >
                    ⌄
                  </Text>
                </Pressable>

                {blocked.length > 0 ? (
                  <Chip
                    label={`Bloqués · ${blocked.length}`}
                    onPress={() => setFace("blocked")}
                  />
                ) : null}
              </View>
            </View>

            <FlatList
              style={styles.fill}
              data={rows}
              keyExtractor={(one) => one.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              onEndReachedThreshold={0.4}
              onEndReached={() => {
                if (loading || drained || rows.length === 0) return;
                const last = rows[rows.length - 1];
                if (last) void fetchPage({ rank: last.rank, id: last.id });
              }}
              ListEmptyComponent={
                loading ? null : (
                  <Text style={styles.nothing}>{look.nothing}</Text>
                )
              }
              ListFooterComponent={
                loading ? (
                  <ActivityIndicator
                    color={palette.inkFaint}
                    style={styles.wait}
                  />
                ) : null
              }
              renderItem={({ item }) => (
                <ThingRow
                  one={item}
                  look={look}
                  busy={taking === item.id}
                  onOpen={() =>
                    look.onTheMap === true
                      ? onTheMap(item)
                      : setTrail([{ kind, thing: item }])
                  }
                  onTake={() => takeIt(item)}
                />
              )}
            />

            {/* The trail, mounted — the last few steps of it, deepest last.

                One card used to stand here and every step swapped what it
                drew, which cost the two things a step back ought to be: free
                and unchanged. The parent had to read itself from the network
                again, and it came back scrolled to the top — a reader who had
                worked down a long classeur to its fortieth event lost their
                place by looking at one of them.

                Kept mounted, each card holds what it loaded and where it was
                scrolled, so "Retour" is nothing but the card above it
                leaving. It also means the parent is *already there*,
                underneath, while that card slides down: the gesture reveals
                it rather than racing to rebuild it.

                How many is `windowed`'s business, and its reason is memory:
                this walk has no ceiling, since an event names its classeur
                and that classeur holds the event.

                Order is the whole of the paint: `risen` is opaque and
                full-bleed, so the deeper card simply covers the one it came
                from. Later siblings win, and `trail` is in the order it was
                walked — which is why these must stay inside `styles.stack`
                and before the settings card, not after it. */}
            {windowed(trail).map(({ step, depth }) => {
              const top = depth === trail.length - 1;
              /** Drawn as the thing it is, not as the thing that held it. */
              const its = LOOKS[step.kind];

              return (
                <Animated.View
                  key={`${depth}:${step.thing.id}`}
                  style={[
                    styles.risen,
                    // Only the top card travels. The ones under it are at
                    // rest and covered; moving them would be moving scenery
                    // nobody can see.
                    top ? { transform: [{ translateY: rise }] } : null,
                  ]}
                  // Buried cards are unreachable by paint order already —
                  // but a ScrollView under an opaque sibling can still catch
                  // a pan on some paths, and a screen reader would happily
                  // read all three. Said plainly instead of relied upon.
                  pointerEvents={top ? "auto" : "none"}
                  accessibilityElementsHidden={!top}
                  importantForAccessibility={
                    top ? "auto" : "no-hide-descendants"
                  }
                >
                  <SharedCard
                    one={step.thing}
                    kind={step.kind}
                    look={its}
                    // What a classeur holds is openable: nobody takes
                    // twenty-seven events on the strength of their titles.
                    onOpenHeld={(one) =>
                      setTrail((was) => [...was, { kind: "event", thing: one }])
                    }
                    // And the other way up: from an event to the classeur it
                    // was filed in. The trail already runs both ways, so
                    // "Retour" comes back to the event rather than out to the
                    // list — a reader can look at the box and decide against
                    // it without losing their place.
                    onOpenFiled={(one) =>
                      setTrail((was) => [
                        ...was,
                        { kind: "folder", thing: one },
                      ])
                    }
                    // A territory is its outline: the card cannot show one,
                    // so it hands the reader to the map. Taking it from there
                    // avoids the trip back for a second decision.
                    onShowShape={(shape) => {
                      const one = step.thing;
                      void showShape(shape, {
                        name: one.title,
                        said: its.under(one),
                        take: its.take,
                        takeable: !one.mine && !one.copied,
                      }).then((taken) => {
                        if (taken) takeIt(one, step.kind);
                      });
                    }}
                    onReport={() => setFace("report")}
                    onBlock={block}
                  />
                </Animated.View>
              );
            })}
          </View>

          {/* A genealogy, over the whole panel: it needs the room, and the
              sheet is already most of the screen. Above the settings card,
              which cannot be open at the same time but would otherwise win
              by being written later. */}
          {drawn === null ? null : (
            <View style={styles.wide}>
              <TreePreview
                tree={drawn.tree}
                faces={drawn.faces}
                said={look.under(drawn.thing)}
                by={drawn.thing.mine ? "vous" : drawn.thing.author}
                takeable={!drawn.thing.mine && !drawn.thing.copied}
                busy={taking === drawn.thing.id}
                onTake={() => takeIt(drawn.thing)}
                onClose={() => setDrawn(null)}
                // The panel reaches the foot of the screen, so the buttons
                // must clear the home indicator themselves — the sheet's own
                // footer, which usually does it, is behind this.
                inset={{ top: 0, bottom: insets.bottom }}
              />
            </View>
          )}

          {/* A card laid on the panel, never a modal over it. See `sifting`.
              Last among its siblings and layered above them, because a
              fragment creates no view: the sheet's own footer is a sibling
              too, and it is written after this. */}
          {sifting === null ? null : (
            <View style={styles.over}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                style={StyleSheet.absoluteFill}
                onPress={close}
              />

              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardHeading}>
                    <Text style={styles.cardTitle}>
                      {sifting === "sort" ? "Trier" : "Filtres"}
                    </Text>
                    <View style={styles.cardRule} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Fermer"
                    hitSlop={10}
                    onPress={close}
                    style={({ pressed }) => [pressed && styles.dim]}
                  >
                    <Text style={styles.cardClose}>×</Text>
                  </Pressable>
                </View>

                {sifting === "sort" ? (
                  <View style={styles.cardBody}>
                    {SORTS.map((one) => {
                      const chosen = search.sort === one.value;
                      return (
                        <Pressable
                          key={one.value}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: chosen }}
                          onPress={() => {
                            setSearch((was) => ({ ...was, sort: one.value }));
                            close();
                          }}
                          style={({ pressed }) => [
                            styles.choice,
                            chosen && styles.choiceOn,
                            pressed && styles.dim,
                          ]}
                        >
                          <Text
                            style={[styles.choiceMark, chosen && styles.onWax]}
                          >
                            {one.mark}
                          </Text>
                          <View style={styles.choiceText}>
                            <Text
                              style={[
                                styles.choiceTitle,
                                chosen && styles.onWax,
                              ]}
                            >
                              {one.label}
                            </Text>
                            <Text
                              style={[
                                styles.choiceWhy,
                                chosen && styles.onWaxSoft,
                              ]}
                            >
                              {one.why}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  /* No scrolling container: the wheels are a virtualized
                     list, and React Native refuses to window one inside a
                     scroll view of the same direction. */
                  <View style={styles.cardBody}>
                    <Text style={styles.siftLegend}>Époque</Text>

                    {tuning ? (
                      <>
                        <DateWheels
                          value={when}
                          onChange={(at) =>
                            setSearch((was) => {
                              // A width the new precision no longer offers
                              // would be a week around a date known only to
                              // the year.
                              const kept = widthsFor(at).some(
                                (one) => one.years === was.span,
                              );
                              return {
                                ...was,
                                at,
                                span: kept ? was.span : widthsFor(at)[0]!.years,
                              };
                            })
                          }
                        />
                        <Text style={styles.siftAt}>
                          {formatHistoricalDate(when)}
                        </Text>
                        <View style={styles.siftRow}>
                          {widthsFor(when).map((one) => (
                            <Chip
                              key={one.label}
                              label={one.label}
                              selected={search.span === one.years}
                              onPress={() =>
                                setSearch((was) => ({
                                  ...was,
                                  span: one.years,
                                }))
                              }
                            />
                          ))}
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setSearch((was) => ({ ...was, span: null }));
                            setTuning(false);
                          }}
                          style={({ pressed }) => [pressed && styles.dim]}
                        >
                          <Text style={styles.clear}>
                            Revenir à toute l'histoire
                          </Text>
                        </Pressable>
                      </>
                    ) : (
                      /* Closed, it says one thing. A date and the words
                         "toute l'histoire" on screen together contradict
                         each other, which is what this replaced. */
                      <Row
                        said={
                          era
                            ? `${formatHistoricalDate(when)} · ${spanSaid}`
                            : "Toute l'histoire"
                        }
                        lit={era}
                        onPress={() => {
                          setSearch((was) => ({
                            ...was,
                            span: was.span ?? widthsFor(when)[0]!.years,
                          }));
                          setTuning(true);
                        }}
                      />
                    )}

                    <View style={styles.siftRule} />

                    <Text style={styles.siftLegend}>Région</Text>
                    <Row
                      said={
                        // `region` implique désormais les deux valeurs ; le
                        // second test ne reste que pour le compilateur.
                        region && search.withinMetres !== null
                          ? `${Math.round(search.withinMetres / 1000)} km autour de ${search.near?.latitude.toFixed(1)}°, ${search.near?.longitude.toFixed(1)}°`
                          : "Partout"
                      }
                      lit={region}
                      onPress={() => {
                        // The point and the reach are set on the map, where
                        // the circle can be seen against the coastlines.
                        void placeRegion(
                          search.near,
                          search.withinMetres ?? 500_000,
                        ).then((zone) => {
                          if (zone === null) return;
                          setSearch((was) => ({
                            ...was,
                            near: {
                              longitude: zone.longitude,
                              latitude: zone.latitude,
                            },
                            withinMetres: zone.metres,
                          }));
                        });
                      }}
                    />
                    {region ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          setSearch((was) => ({
                            ...was,
                            near: null,
                            withinMetres: null,
                          }))
                        }
                        style={({ pressed }) => [pressed && styles.dim]}
                      >
                        <Text style={styles.clear}>Chercher partout</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </View>
            </View>
          )}
        </>
      )}
    </Sheet>
  );
}

/**
 * A setting at rest: what it is now, and a way to change it.
 *
 * Wax once it is narrowing something, so a card opened at a glance says
 * whether anything is being held back.
 */
function Row({
  said,
  lit,
  onPress,
}: {
  said: string;
  lit: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={said}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        lit && styles.rowOn,
        pressed && styles.dim,
      ]}
    >
      <Text style={[styles.rowSaid, lit && styles.onWax]} numberOfLines={2}>
        {said}
      </Text>
      <Text style={[styles.rowMore, lit && styles.onWax]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  /** The padding a face's own scrolling body takes. */
  reading: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.md,
  },
  sieve: {
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    gap: space.md,
  },
  tools: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  /** A drawn button, like the discs on the plate: edged and lifted. */
  tool: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: palette.paperLight,
    borderWidth: 1.5,
    borderColor: palette.paperDeep,
  },
  /** Wax once it is doing something, so a narrowed list says so. */
  toolOn: { backgroundColor: palette.wax, borderColor: palette.waxDeep },
  toolLabel: { ...type.legend, fontWeight: "700", color: palette.ink },
  toolLabelOn: { color: palette.paperLight },
  toolMore: { ...type.legend, color: palette.inkFaint },

  /** The drawing, over everything the sheet holds. */
  wide: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },

  /**
   * The settings, laid over the panel.
   *
   * Absolute against the **panel** and not against the list's own room, so
   * the dim reaches the heading above and the button below: a card that
   * darkened the middle of a sheet and left its two ends lit read as a
   * mistake rather than as a card.
   *
   * It clips to the sheet, so it looks centred on it, and the list stays
   * faintly visible behind — it is what the settings are about. And being no
   * modal at all is what lets the region filter hand the screen to the
   * reticle without anything being dismissed from underneath it.
   */
  /**
   * The room the list and the card being read share.
   *
   * The card is absolute inside *this* rather than inside the panel, and it
   * has to stay so for two reasons that were each learnt the hard way: laid
   * over the panel it hid the very heading that says what is being read, and
   * it covered the sheet's own footer — the buttons that take a copy and go
   * back were still there, behind it.
   *
   * The settings card is the opposite case and sits outside: it dims, and a
   * dim that stops short of the heading reads as a mistake.
   */
  stack: { flex: 1 },
  risen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    backgroundColor: palette.paperLight,
  },

  over: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    /**
     * Above every sibling, and the footer is one of them.
     *
     * Drawing order alone is not enough: a fragment creates no view, so this
     * card, the list, the header and the sheet's own footer are all children
     * of the same panel — and the footer is written after them. Being last
     * among its own siblings puts the card over the list; the layer puts it
     * over the footer as well, which it must cover, or a tap meant for the
     * card's backdrop would close the whole sheet.
     */
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
    backgroundColor: BACKDROP,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "94%",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.paperDeep,
    ...shadow.lifted,
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  cardHeading: { flex: 1, gap: space.xs },
  cardTitle: { ...type.plate, fontSize: 21, color: palette.ink },
  /** Drawn under the word, the way every heading in this app is. */
  cardRule: {
    height: 3,
    width: "42%",
    minWidth: 48,
    borderRadius: radius.pill,
    backgroundColor: palette.paperDeep,
  },
  cardClose: {
    fontSize: 26,
    lineHeight: 28,
    color: palette.inkFaint,
    marginTop: -4,
  },
  cardBody: { gap: space.md },

  /**
   * One of two ways to order the list: a mark, a name, and why.
   *
   * Written out rather than left to a segmented control, because the two are
   * not two settings of one thing — they are two different questions about
   * what matters, and one line each is what says so.
   */
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: palette.sunken,
  },
  choiceOn: { backgroundColor: palette.wax },
  choiceMark: {
    fontSize: 18,
    width: 22,
    textAlign: "center",
    color: palette.wax,
  },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { fontSize: 15.5, fontWeight: "700", color: palette.ink },
  choiceWhy: { ...type.legend, color: palette.inkSoft },
  onWax: { color: palette.paperLight },
  onWaxSoft: { color: palette.paperLight, opacity: 0.78 },

  /** A rule between the two questions, drawn rather than ruled across. */
  siftRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.line,
    marginVertical: space.xs,
  },
  /** A closed setting: what it is now, and a way in. */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  rowOn: { backgroundColor: palette.wax },
  rowSaid: { flex: 1, fontSize: 15, fontWeight: "600", color: palette.ink },
  rowMore: { fontSize: 20, lineHeight: 22, color: palette.inkFaint },

  sift: { gap: space.sm },
  siftLegend: {
    ...type.legend,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: palette.inkFaint,
  },
  siftRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  siftAt: {
    ...type.body,
    fontWeight: "700",
    color: palette.wax,
    textAlign: "center",
  },
  clear: {
    ...type.legend,
    color: palette.inkFaint,
    textDecorationLine: "underline",
    alignSelf: "flex-start",
  },
  list: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.sm },
  nothing: {
    ...type.body,
    color: palette.inkFaint,
    textAlign: "center",
    paddingVertical: space.xxl,
    paddingHorizontal: space.md,
  },
  wait: { paddingVertical: space.lg },

  dim: { opacity: 0.6 },
  lead: { ...type.body, color: palette.inkSoft },
  reason: {
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  reasonOn: { backgroundColor: palette.wax },
  reasonLabel: { fontSize: 15, fontWeight: "600", color: palette.ink },
  reasonLabelOn: { color: palette.paperLight },

  blocked: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  blockedName: { flex: 1, fontSize: 15, fontWeight: "600", color: palette.ink },
  unblock: { paddingHorizontal: space.sm, paddingVertical: 4 },
  unblockLabel: { ...type.caption, fontWeight: "700", color: palette.wax },

  aside: { ...type.legend, color: palette.inkFaint },
});
