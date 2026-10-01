import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import * as api from "./api";

import { InkButton } from "../../components/ui";
import { EVENT_LOOK } from "./looks";
import { ThingRow } from "./ThingRow";
import type { Kind, Look, SharedThing } from "./types";
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
  /**
   * Opens one of the things this one holds — a classeur's events.
   *
   * Absent where nothing is held, and absent on purpose where it would be a
   * dead end. Being told a box has twenty-seven events in it is no help if
   * none of them can be looked at.
   */
  onOpenHeld?: (one: SharedThing) => void;
  /**
   * Lays this one's shape on the plate, for the kinds that have one.
   *
   * A territory is its outline and nothing else; a card cannot show that.
   */
  onShowShape?: (shape: unknown) => void;
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
  onOpenHeld,
  onShowShape,
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
      {/* No badge naming the kind: the sheet's own title already says
          "Un classeur", and saying it twice on one card is furniture. */}
      <Text style={styles.when}>{look.under(one)}</Text>
      <Text style={styles.title}>{one.title}</Text>
      <Text style={styles.by}>
        {one.mine ? "Écrit par vous" : `Écrit par ${one.author}`}
        {one.stars > 0
          ? ` · copié ${one.stars} fois`
          : " · personne ne l'a encore copié"}
      </Text>

      {whole?.shape && onShowShape ? (
        <>
          <InkButton
            label="Voir sur la carte"
            variant="solid"
            onPress={() => onShowShape(whole.shape)}
          />
          <Text style={styles.aside}>
            Un territoire n'est que son tracé : il faut le voir sur la carte
            pour savoir ce qu'il couvre.
          </Text>
        </>
      ) : null}

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

      {/* What is in the box, drawn with the catalogue's own line: a picture,
          a title and a period say what a list of names could not. Inert —
          the reader is taking the classeur, not choosing among these. */}
      {(whole?.held ?? []).length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.legend}>{look.castLegend}</Text>
          <View style={styles.held}>
            {(whole?.held ?? []).map((one) => (
              <ThingRow
                key={one.id}
                one={one}
                look={EVENT_LOOK}
                {...(onOpenHeld ? { onOpen: () => onOpenHeld(one) } : {})}
              />
            ))}
          </View>
          <Text style={styles.aside}>
            {onOpenHeld
              ? `Touchez-en un pour le lire. ${look.castAside}`
              : look.castAside}
          </Text>
        </View>
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
    // Air above the first line: the card sits under the sheet's handle, with
    // no heading between them, and text against the edge of the paper looks
    // like text that fell off.
    paddingTop: space.md,
    paddingBottom: space.lg,
    gap: space.md,
  },
  when: { fontSize: 14, color: palette.wax, fontWeight: "600" },
  title: { fontSize: 24, lineHeight: 30, color: palette.ink, fontWeight: "700" },
  by: { ...type.legend, color: palette.inkFaint },
  body: { ...type.body, color: palette.inkSoft },
  photos: { flexDirection: "row", gap: space.md },
  photo: { width: 168, height: 120, borderRadius: radius.md },
  section: { gap: 2 },
  /** Room between the rows, which carry their own edge and shadow. */
  held: { gap: space.sm, paddingTop: space.xs },
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
