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
import { useEvents } from "../events/EventsProvider";
import { formatHistoricalDate } from "../events/historicalDate";
import { widthsFor } from "./period";
import { usePlacement } from "../placement";
import { ANSWER_WITHIN, CONTACT } from "../../config/contact";
import { palette } from "../../theme/palette";
import { BACKDROP, radius, shadow, space, type } from "../../theme/tokens";

const SORTS: { value: Ordering; label: string; said: string }[] = [
  { value: "stars", label: "Les plus copiés", said: "étoiles" },
  { value: "recent", label: "Les plus récents", said: "récents" },
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
  const { aiming, placeRegion, looking } = usePlacement();
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

  /** How many of the two filters are doing something, for the button. */
  const era = search.span !== null && search.at !== null;
  const region = search.near !== null;
  const narrowed = (era ? 1 : 0) + (region ? 1 : 0);

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
      // Out of the way while the reader aims at the map — the region filter
      // asks for a point the same way everything else in this app does — and
      // back afterwards with the sieve exactly as they left it.
      visible={visible && !aiming}
      onClose={onClose}
      onClosed={aiming ? undefined : onClosed}
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
                  style={[styles.toolLabel, narrowed > 0 && styles.toolLabelOn]}
                >
                  {narrowed === 0 ? "Filtres" : `Filtres · ${narrowed}`}
                </Text>
                <Text
                  style={[styles.toolMore, narrowed > 0 && styles.toolLabelOn]}
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
              <Entry
                one={item}
                look={look}
                busy={taking === item.id}
                onOpen={() => setReading(item)}
                onTake={() => takeIt(item)}
              />
            )}
          />

          {/* A card laid on the panel, never a modal over it. See `sifting`. */}
          {sifting === null ? null : (
            <View style={styles.over}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                style={StyleSheet.absoluteFill}
                onPress={() => setSifting(null)}
              />
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>
                    {sifting === "sort" ? "Trier" : "Filtres"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Fermer"
                    hitSlop={8}
                    onPress={() => setSifting(null)}
                    style={({ pressed }) => [pressed && styles.dim]}
                  >
                    <Text style={styles.cardClose}>×</Text>
                  </Pressable>
                </View>

                {sifting === "sort" ? (
                  <View style={styles.cardBody}>
                    {SORTS.map((one) => (
                      <InkButton
                        key={one.value}
                        label={one.label}
                        variant={search.sort === one.value ? "solid" : "tonal"}
                        onPress={() => {
                          setSearch((was) => ({ ...was, sort: one.value }));
                          setSifting(null);
                        }}
                      />
                    ))}
                  </View>
                ) : (
                  // No scrolling container here: the wheels below are a
                  // virtualized list, and React Native refuses to window one
                  // nested in a scroll view of the same direction. The card is
                  // sized to hold them instead.
                  <View style={styles.cardBody}>
                    <View style={styles.sift}>
                      <Text style={styles.siftLegend}>Époque</Text>
                      <DateWheels
                        value={search.at ?? { year: new Date().getFullYear() }}
                        onChange={(at) =>
                          setSearch((was) => {
                            // A width the new precision no longer offers would be a
                            // week around a date known only to the year.
                            const kept = widthsFor(at).some(
                              (one) => one.years === was.span,
                            );
                            return { ...was, at, span: kept ? was.span : null };
                          })
                        }
                      />
                      <Text style={styles.siftAt}>
                        {formatHistoricalDate(
                          search.at ?? { year: new Date().getFullYear() },
                        )}
                      </Text>

                      <View style={styles.siftRow}>
                        <Chip
                          label="Toute l'histoire"
                          selected={search.span === null}
                          onPress={() =>
                            setSearch((was) => ({ ...was, span: null }))
                          }
                        />
                        {/* Which three, and why those three, is decided in `period.ts`:
                  a reader who named a day is asking about a day. */}
                        {widthsFor(
                          search.at ?? { year: new Date().getFullYear() },
                        ).map((one) => (
                          <Chip
                            key={one.label}
                            label={one.label}
                            selected={search.span === one.years}
                            onPress={() =>
                              setSearch((was) => ({ ...was, span: one.years }))
                            }
                          />
                        ))}
                      </View>
                    </View>

                    <View style={styles.sift}>
                      <Text style={styles.siftLegend}>Région</Text>
                      <Text style={styles.spot}>
                        {region && search.withinMetres !== null
                          ? `${Math.round(search.withinMetres / 1000)} km autour de ${search.near?.latitude.toFixed(2)}°, ${search.near?.longitude.toFixed(2)}°`
                          : "Partout"}
                      </Text>
                      {/* The point and the radius are chosen together, on the map,
                where the circle can be seen against the coastlines. Chips
                here could only name a distance nobody can picture. */}
                      <InkButton
                        label={region ? "Changer la zone" : "Choisir une zone"}
                        variant="tonal"
                        onPress={() => {
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
                  </View>
                )}
              </View>
            </View>
          )}
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

  /**
   * The settings, laid over the panel.
   *
   * Absolute inside the sheet, which clips it: the card reads as centred on
   * the sheet and the list stays faintly visible behind — it is what the
   * settings are about. And being no modal at all is what lets the region
   * filter hand the screen to the reticle without anything being dismissed
   * from underneath it.
   */
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
  cardTitle: { ...type.plate, flex: 1, fontSize: 20, color: palette.ink },
  cardClose: {
    fontSize: 24,
    lineHeight: 26,
    color: palette.inkFaint,
    marginTop: -2,
  },
  cardBody: { gap: space.md },

  sift: { gap: space.sm },
  siftLegend: { ...type.legend, fontWeight: "700", color: palette.inkSoft },
  siftRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  siftAside: { ...type.legend, color: palette.inkFaint },
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
  /** The thing the width is measured from: a year, or a point. */
  centre: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.md,
  },
  yearField: { minWidth: 96 },
  spot: { ...type.body, flex: 1, color: palette.ink },
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
