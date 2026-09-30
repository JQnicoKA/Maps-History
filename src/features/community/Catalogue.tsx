import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import * as api from "./api";
import { SharedCard } from "./SharedCard";
import {
  ANYTHING,
  REASONS,
  type Blocked,
  type Cursor,
  type Kind,
  type Reason,
  type Search,
  type SharedThing,
} from "./types";
import {
  Chip,
  InkButton,
  InkField,
  SegmentedControl,
  Sheet,
  useNotice,
} from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { formatYear } from "../events/historicalDate";
import { usePlacement } from "../placement";
import { ANSWER_WITHIN, CONTACT } from "../../config/contact";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

/** How wide "cette région" is, in metres — a long day's ride either way. */
const NEARBY = 500_000;
/** And how deep "cette époque" reaches, in years either side. */
const ERA = 50;

const SORTS = [
  { value: "stars" as const, label: "Étoiles" },
  { value: "recent" as const, label: "Récents" },
  { value: "near" as const, label: "Proches" },
];

/** What a kind looks like, which is all that differs between the five. */
export type Look = {
  /** "Chronique commune", and what one of them is called on its own. */
  many: string;
  one: string;
  /** Stands in for a missing picture — an emoji, an initial. */
  glyph: (thing: SharedThing) => string;
  /** The line under the title: a period, a lifespan, a reign. */
  under: (thing: SharedThing) => string;
  /** What the two name lists mean for this kind. */
  castLegend: string;
  castAside: string;
  filedLegend: string;
  filedAside: string;
  nothing: string;
};

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
 * of things and a chronicle written by many hands.
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
  const { looking } = usePlacement();
  const { say, dialog } = useNotice();

  const [search, setSearch] = useState<Search>(ANYTHING);
  const [rows, setRows] = useState<SharedThing[]>([]);
  const [loading, setLoading] = useState(false);
  const [drained, setDrained] = useState(false);
  const [reading, setReading] = useState<SharedThing | null>(null);
  const [taking, setTaking] = useState<string | null>(null);
  /**
   * Which of the four faces is up.
   *
   * Faces and not panels: a sheet cannot present a sheet, and turning a card
   * over is what the rest of the app does with the same problem.
   */
  const [face, setFace] = useState<"list" | "report" | "blocked">("list");
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
          "Chronique illisible",
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

  const report = () => {
    const one = reading;
    if (!one) return;
    setTaking(one.id);
    void api
      .report(kind, one.id, why, said)
      .then(() => {
        setRows((current) =>
          current.map((row) =>
            row.id === one.id ? { ...row, reported: true } : row,
          ),
        );
        setReading({ ...one, reported: true });
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
    const one = reading;
    if (!one) return;
    setTaking(one.id);
    void api
      .blockAuthorOf(kind, one.id)
      .then(() => {
        setReading(null);
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

  const era = search.from !== null;
  const region = search.near !== null;

  const takeIt = (one: SharedThing) => {
    setTaking(one.id);
    void api
      .copy(kind, one.id)
      .then(async () => {
        // The collection has a row it does not know about, and the map draws
        // from what it holds.
        await refresh();
        setRows((current) =>
          current.map((row) =>
            row.id === one.id
              ? { ...row, copied: true, stars: row.stars + 1 }
              : row,
          ),
        );
        setReading((current) =>
          current && current.id === one.id
            ? { ...current, copied: true, stars: current.stars + 1 }
            : current,
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
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      tall
      liftsForKeyboard={false}
      title={
        face === "report"
          ? "Signaler"
          : face === "blocked"
            ? "Personnes bloquées"
            : reading === null
              ? look.many
              : look.one
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
        ) : reading === null ? (
          <InkButton label="Fermer" variant="tonal" grow onPress={onClose} />
        ) : (
          <>
            <InkButton
              label="Retour"
              variant="tonal"
              grow
              onPress={() => setReading(null)}
            />
            <InkButton
              label={
                reading.mine
                  ? "Le vôtre"
                  : reading.copied
                    ? "Déjà copié"
                    : taking === reading.id
                      ? "Copie…"
                      : "Copier"
              }
              variant="solid"
              grow
              disabled={reading.mine || reading.copied || taking !== null}
              onPress={() => takeIt(reading)}
            />
          </>
        )
      }
    >
      {dialog}

      {face === "report" ? (
        <ScrollView contentContainerStyle={styles.reading}>
          <Text style={styles.lead}>
            Dites-nous ce qui ne va pas avec « {reading?.title} ». Son auteur
            n'en saura rien. Assez de signalements et la chose quitte la
            chronique en attendant d'être relue.
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
              de votre chronique, et le vôtre de la sienne.
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
      ) : reading === null ? (
        <>
          <View style={styles.sieve}>
            <InkField
              label="Nom"
              value={search.words}
              onChangeText={(words) => setSearch((was) => ({ ...was, words }))}
              placeholder="Marignan, sacre, traité…"
              autoCorrect={false}
              returnKeyType="search"
            />

            <SegmentedControl
              segments={SORTS}
              value={search.sort}
              onChange={(sort) =>
                setSearch((was) => ({
                  ...was,
                  sort,
                  // Sorting by nearness needs somewhere to be near.
                  near:
                    sort === "near" ? (looking.current ?? was.near) : was.near,
                  withinMetres:
                    sort === "near" && was.withinMetres === null
                      ? null
                      : was.withinMetres,
                }))
              }
            />

            {/* Both lean on what the reader is already looking at, which is
                why they are two taps and not two date pickers. */}
            <View style={styles.chips}>
              <Chip
                label={
                  year === null
                    ? "Cette époque"
                    : `Vers ${formatYear(Math.trunc(year))}`
                }
                selected={era}
                onPress={() =>
                  setSearch((was) =>
                    era || year === null
                      ? { ...was, from: null, to: null }
                      : {
                          ...was,
                          from: Math.trunc(year) - ERA,
                          to: Math.trunc(year) + ERA,
                        },
                  )
                }
              />
              <Chip
                label="Cette région"
                selected={region}
                onPress={() =>
                  setSearch((was) =>
                    region
                      ? { ...was, near: null, withinMetres: null }
                      : {
                          ...was,
                          near: looking.current,
                          withinMetres: NEARBY,
                        },
                  )
                }
              />
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
                <ActivityIndicator color={palette.inkFaint} style={styles.wait} />
              ) : null
            }
            renderItem={({ item }) => (
              <Entry
                one={item}
                look={look}
                busy={taking === item.id}
                onOpen={() => setReading(item)}
                onTake={() => takeIt(item)}
              />
            )}
          />
        </>
      ) : (
        <SharedCard
          one={reading}
          kind={kind}
          look={look}
          onReport={() => setFace("report")}
          onBlock={block}
        />
      )}
    </Sheet>
  );
}

/** One line of the catalogue: what it is, who wrote it, how many took it. */
function Entry({
  one,
  look,
  busy,
  onOpen,
  onTake,
}: {
  one: SharedThing;
  look: Look;
  busy: boolean;
  onOpen: () => void;
  onTake: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={one.title}
      onPress={onOpen}
      style={({ pressed }) => [styles.entry, pressed && styles.dim]}
    >
      <View style={styles.thumb}>
        {one.cover === null ? (
          <Text style={styles.emoji}>{look.glyph(one)}</Text>
        ) : (
          <Image source={{ uri: one.cover }} style={styles.thumbImage} />
        )}
      </View>

      <View style={styles.entryText}>
        <Text style={styles.entryTitle} numberOfLines={2}>
          {one.title}
        </Text>
        <Text style={styles.entryWhen}>{look.under(one)}</Text>
        <Text style={styles.entryWho} numberOfLines={1}>
          {one.mine ? "vous" : one.author}
          {one.stars > 0 ? ` · ★ ${one.stars}` : ""}
        </Text>
      </View>

      {/* The one thing to do with somebody else's work, on the line itself:
          reading it first is a choice, not a toll. */}
      {one.mine ? null : one.copied ? (
        <Text style={styles.taken}>✓</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Copier ${one.title}`}
          hitSlop={8}
          disabled={busy}
          onPress={onTake}
          style={({ pressed }) => [styles.take, pressed && styles.dim]}
        >
          <Text style={styles.takeGlyph}>{busy ? "…" : "+"}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const THUMB = 54;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sieve: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  list: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.sm },
  nothing: {
    ...type.body,
    color: palette.inkFaint,
    textAlign: "center",
    paddingVertical: space.xxl,
    paddingHorizontal: space.md,
  },
  wait: { paddingVertical: space.lg },

  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    ...shadow.soft,
  },
  dim: { opacity: 0.6 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 4,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.sunken,
  },
  thumbImage: { width: "100%", height: "100%" },
  emoji: { fontSize: 22 },
  entryText: { flex: 1, gap: 1 },
  entryTitle: { fontSize: 15, fontWeight: "700", color: palette.ink },
  entryWhen: { ...type.legend, color: palette.wax, fontWeight: "600" },
  entryWho: { ...type.legend, color: palette.inkFaint },
  take: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
  },
  takeGlyph: {
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "700",
    color: palette.paperLight,
  },
  taken: { fontSize: 18, color: palette.forest, paddingHorizontal: space.sm },

  reading: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.md,
  },
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
