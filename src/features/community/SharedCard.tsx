import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import * as api from "./api";
import type { Look } from "./Catalogue";
import type { Kind, SharedThing } from "./types";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

export type SharedCardProps = {
  one: SharedThing;
  kind: Kind;
  look: Look;
  /**
   * The two things one can do *about* somebody's work, rather than with it.
   *
   * Optional, and absent where they would be out of place: the card shown
   * while writing an event exists to answer "is this the one?", and a
   * reporting link at that moment reads as a warning about the thing one is
   * about to take.
   */
  onReport?: () => void;
  onBlock?: () => void;
};

/**
 * Somebody else's contribution, read whole, before deciding anything.
 *
 * Shared by the catalogue, where it is one of the panel's faces, and by the
 * card that warns of a duplicate while an event is being written — where it
 * is the whole point: being told that something resembles what you are
 * writing is useless if you cannot look at it.
 *
 * The head is drawn from what the list already carried, and the rest fills in
 * underneath. Nothing waits on the network that does not have to.
 */
export function SharedCard({
  one,
  kind,
  look,
  onReport,
  onBlock,
}: SharedCardProps) {
  const [whole, setWhole] = useState<
    Awaited<ReturnType<typeof api.fetchWhole>> | null
  >(null);

  useEffect(() => {
    let alive = true;
    void api
      .fetchWhole(kind, one.id)
      .then((found) => {
        if (alive) setWhole(found);
      })
      .catch(() => {
        // The card still has everything the list carried; a failed read of
        // the rest is a thinner card, not an error worth a dialogue.
      });
    return () => {
      alive = false;
    };
  }, [kind, one.id]);

  return (
    <ScrollView contentContainerStyle={styles.reading}>
      <View style={styles.badge}>
        <Text style={styles.badgeEmoji}>{look.glyph(one)}</Text>
        <Text style={styles.badgeLabel}>{look.one}</Text>
      </View>
      <Text style={styles.when}>{look.under(one)}</Text>
      <Text style={styles.title}>{one.title}</Text>
      <Text style={styles.by}>
        {one.mine ? "Écrit par vous" : `Écrit par ${one.author}`}
        {one.stars > 0
          ? ` · copié ${one.stars} fois`
          : " · personne ne l'a encore copié"}
      </Text>

      {whole?.description ? (
        <Text style={styles.body}>{whole.description}</Text>
      ) : null}

      {(whole?.photos ?? []).length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.photos}>
            {(whole?.photos ?? []).map((photo) => (
              <Image
                key={photo.url}
                source={{ uri: photo.url }}
                style={styles.photo}
              />
            ))}
          </View>
        </ScrollView>
      ) : null}

      {(whole?.cast ?? []).length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.legend}>{look.castLegend}</Text>
          <Text style={styles.names}>{(whole?.cast ?? []).join(" · ")}</Text>
          <Text style={styles.aside}>{look.castAside}</Text>
        </View>
      ) : null}

      {/* Quiet, and at the foot: most readers never need either, and a card
          that leads with "signaler" reads as a warning about its own
          contents. Absent on one's own work, which one can simply take out
          of the chronicle. */}
      {one.mine || !onReport || !onBlock ? null : (
        <View style={styles.against}>
          <Pressable
            accessibilityRole="button"
            disabled={one.reported}
            onPress={onReport}
            style={({ pressed }) => [pressed && styles.dim]}
          >
            <Text style={styles.quiet}>
              {one.reported ? "Déjà signalé" : "Signaler"}
            </Text>
          </Pressable>
          <Text style={styles.quietDot}>·</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onBlock}
            style={({ pressed }) => [pressed && styles.dim]}
          >
            <Text style={styles.quiet}>Bloquer {one.author}</Text>
          </Pressable>
        </View>
      )}

      {(whole?.folders ?? []).length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.legend}>{look.filedLegend}</Text>
          <Text style={styles.names}>{(whole?.folders ?? []).join(" · ")}</Text>
          <Text style={styles.aside}>{look.filedAside}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  reading: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.md,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: palette.sunken,
  },
  badgeEmoji: { fontSize: 14 },
  badgeLabel: { fontSize: 13, color: palette.inkSoft, fontWeight: "500" },
  when: { fontSize: 14, color: palette.wax, fontWeight: "600" },
  title: { fontSize: 24, lineHeight: 30, color: palette.ink, fontWeight: "700" },
  by: { ...type.legend, color: palette.inkFaint },
  body: { ...type.body, color: palette.inkSoft },
  photos: { flexDirection: "row", gap: space.md },
  photo: { width: 168, height: 120, borderRadius: radius.md },
  section: { gap: 2 },
  legend: { ...type.legend, color: palette.inkFaint },
  names: { ...type.body, color: palette.ink },
  aside: { ...type.legend, color: palette.inkFaint },
  dim: { opacity: 0.6 },

  /** The two things one can do about somebody else's work. */
  against: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingTop: space.sm,
  },
  quiet: {
    ...type.legend,
    color: palette.inkFaint,
    textDecorationLine: "underline",
  },
  quietDot: { ...type.legend, color: palette.inkFaint },
});
