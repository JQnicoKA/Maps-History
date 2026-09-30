import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import * as api from "./api";
import type { Kind, Look, SharedThing } from "./types";
import { InkButton, Sheet, useLingering, useNotice } from "../../components/ui";
import { SharedCard } from "./SharedCard";

import { formatEventPeriod } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

export type LikelyDuplicatesProps = {
  kind: Kind;
  /** How this kind reads — the same description the catalogue uses. */
  look: Look;
  /** What the thing is called in the sentence: "événement", "personnage". */
  noun: string;
  title: string;
  /** Null until a year is chosen, which is when this has anything to say. */
  year: number | null;
  approximate: boolean;
  /**
   * Fired with the identifier of the copy just made, so the screen can go
   * and show it. The form is done.
   */
  onTaken: (id: string) => void;
};

/**
 * "Somebody has already written this."
 *
 * Shown in the step that asks for the date and not in the one that asks for
 * the title, and the reason is measured rather than felt: on a collection of
 * thirty-nine events the title alone raised forty-six warnings, every one of
 * them wrong — "Mort de Clotaire" against "Mort de Clotaire II", "Fin de la
 * faide royale" against "Début de la faide royale". With the year, three
 * warnings and all three genuine. A history collection is full of numbered
 * homonyms; the year is what tells them apart.
 *
 * Never a blockage, and never a choice made for the reader. Several events
 * can carry one name and be different facts — this very collection holds a
 * "Sacre de Pépin le bref" and a "Second sacre de Pépin le bref" four years
 * apart — so the card lists them, says who wrote each and how many readers
 * kept it, and leaves the decision where it belongs.
 */
export function LikelyDuplicates({
  kind,
  look,
  noun,
  title,
  year,
  approximate,
  onTaken,
}: LikelyDuplicatesProps) {
  const [alike, setAlike] = useState<SharedThing[]>([]);
  const [taking, setTaking] = useState<string | null>(null);
  /**
   * The one being looked at, if any.
   *
   * Being told that something resembles what you are writing is useless if
   * you cannot look at it: the whole question is "is this the one?", and only
   * the thing itself answers. A sheet over the form rather than a page
   * elsewhere, so the half-written event is still there behind it.
   */
  const [reading, setReading] = useState<SharedThing | null>(null);
  const shown = useLingering(reading);
  const { say, dialog } = useNotice();
  /** Which question is the current one; answers do not come back in order. */
  const asked = useRef(0);

  useEffect(() => {
    if (title.trim() === "" || year === null) {
      setAlike([]);
      return;
    }
    const mine = ++asked.current;
    const waiting = setTimeout(() => {
      void api
        .alike(kind, title, year, approximate)
        .then((found) => {
          if (asked.current === mine) setAlike(found);
        })
        .catch(() => {
          // A silent failure is right here: this is an offer, not a step.
          if (asked.current === mine) setAlike([]);
        });
    }, 350);
    return () => clearTimeout(waiting);
  }, [kind, title, year, approximate]);

  if (alike.length === 0) return null;

  const take = (one: SharedThing) => {
    setTaking(one.id);
    void api
      .copy(kind, one.id)
      .then((made) => onTaken(made))
      .catch((cause: unknown) =>
        say(
          "Copie impossible",
          cause instanceof Error ? cause.message : String(cause),
        ),
      )
      .finally(() => setTaking(null));
  };

  return (
    <View style={styles.frame}>
      {dialog}
      <Text style={styles.heading}>
        {alike.length === 1
          ? `Un ${noun} ressemble à celui-ci`
          : `${alike.length} ${noun}s ressemblent à celui-ci`}
      </Text>

      {alike.map((one) => (
        <Pressable
          key={one.id}
          accessibilityRole="button"
          accessibilityLabel={`Voir ${one.title}`}
          onPress={() => setReading(one)}
          style={({ pressed }) => [styles.row, pressed && styles.dim]}
        >
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={2}>
              {one.title}
            </Text>
            <Text style={styles.by} numberOfLines={1}>
              {one.start === null
                ? ""
                : formatEventPeriod({
                    start: one.start,
                    end: one.end,
                  } as Parameters<typeof formatEventPeriod>[0])}
              {" · "}
              {one.mine ? "vous" : one.author}
              {one.stars > 0 ? ` · ★ ${one.stars}` : ""}
            </Text>
          </View>

          {one.mine ? (
            <Text style={styles.already}>le vôtre</Text>
          ) : one.copied ? (
            <Text style={styles.already}>déjà pris</Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Prendre ${one.title}`}
              disabled={taking !== null}
              onPress={() => take(one)}
              style={({ pressed }) => [styles.take, pressed && styles.dim]}
            >
              <Text style={styles.takeLabel}>
                {taking === one.id ? "…" : "Prendre"}
              </Text>
            </Pressable>
          )}
        </Pressable>
      ))}

      <Text style={styles.aside}>
        Touchez-en un pour le lire. Le vôtre dira peut-être autre chose :
        continuez si c'est le cas.
      </Text>

      {shown === null ? null : (
        <Sheet
          visible={reading !== null}
          onClose={() => setReading(null)}
          tall
          title={look.one}
          footer={
            <>
              <InkButton
                label="Retour"
                variant="tonal"
                grow
                onPress={() => setReading(null)}
              />
              <InkButton
                label={
                  shown.mine
                    ? "Le vôtre"
                    : shown.copied
                      ? "Déjà pris"
                      : taking === shown.id
                        ? "…"
                        : "Prendre celui-ci"
                }
                variant="solid"
                grow
                disabled={shown.mine || shown.copied || taking !== null}
                onPress={() => take(shown)}
              />
            </>
          }
        >
          {/* No reporting from here: this card exists to answer "is this the
              one?", and a reporting link at that moment would read as a
              warning about the very thing one is about to take. */}
          <SharedCard one={shown} kind={kind} look={look} />
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Set apart from the field above it: this is not part of the question. */
  frame: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
    borderLeftWidth: 3,
    borderLeftColor: palette.wax,
  },
  heading: { ...type.legend, fontWeight: "700", color: palette.wax },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: palette.paperLight,
  },
  text: { flex: 1, gap: 1 },
  title: { fontSize: 14.5, fontWeight: "700", color: palette.ink },
  by: { ...type.legend, color: palette.inkFaint },
  take: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
  },
  takeLabel: { ...type.legend, fontWeight: "700", color: palette.paperLight },
  already: { ...type.legend, color: palette.inkFaint, paddingHorizontal: space.sm },
  dim: { opacity: 0.6 },
  aside: { ...type.legend, color: palette.inkFaint },
});
