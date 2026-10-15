import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { InkButton } from "./InkButton";
import { Grain, JournalTitle } from "./Scrapbook";
import { palette } from "../../theme/palette";
import {
  BACKDROP,
  BACKDROP_SOFT,
  radius,
  shadow,
  space,
  type,
} from "../../theme/tokens";

export type DialogProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * Fired once the card has finished leaving and the modal is gone.
   *
   * The same promise `Sheet` makes, and for the same reason: iOS will not
   * present a second modal from a controller that is still dismissing one, so
   * "close this card, then open that panel" has to wait for this rather than
   * guess at a delay. That is why the fade is driven here instead of by the
   * modal's own `animationType` — a modal that fades itself out never says
   * when it has finished.
   */
  onClosed?: () => void;
  /**
   * The heading, when the card needs one.
   *
   * Absent for a card that is **entirely its own answer** — a field and the
   * things it sifts, where a title would only name what the reader is already
   * looking at. The cross keeps its corner, on a line of its own: tapping
   * beside the card also closes it, but that is not something to have to know.
   */
  title?: string;
  /** A line under the title, when the choice needs one. */
  hint?: string;
  /**
   * The way out at the foot of the card — "Annuler" unless told otherwise.
   *
   * `null` leaves only the cross in the corner, which is enough when the card
   * holds no choice to back out of.
   */
  dismissLabel?: string | null;
  /**
   * What that button does, when it is not simply closing the card.
   *
   * A card that changed its face — asking "are you sure?" where it listed
   * choices — backs out to its first face rather than off the screen. The cross
   * in the corner always closes.
   */
  onDismiss?: () => void;
  /**
   * Title it the way a bottom sheet titles itself: centred, under its own
   * rule, at the sheets' own size.
   *
   * For the cards that are **panels rather than questions** — Filtres, Votre
   * compte. They are opened to be read and adjusted, like a sheet, and happen
   * to be shown in the middle only because they are small; a title shoved to
   * the left marks them out as a different kind of thing from every other
   * panel in the app, which they are not.
   *
   * A card that really does ask a question keeps its heading left, where the
   * eye starts reading.
   */
  centred?: boolean;
  /**
   * How heavily this card veils what is behind it.
   *
   * `"full"` by default, and that is what a dialogue is for: nothing behind is
   * touchable until it is answered, and the dimming says so.
   *
   * **Pass `"soft"` when it opens from inside a sheet or another card**, which
   * has already laid the very same `BACKDROP`. Two of them is not twice as
   * clear, it is `0.42` over `0.42` — two thirds of brown across the whole
   * screen, which reads as a rendering fault rather than as a question. And no
   * veil at all was tried: it leaves pale paper on pale paper with nothing but
   * a shadow between them, and the card does not come forward. `"soft"` is the
   * same brown, light enough to be a second layer and dark enough to show the
   * card's edge.
   *
   * The pressable backdrop is there whichever is chosen, so tapping beside the
   * card always closes it; only the paint changes.
   *
   * A sheet needs none of this: its panel is opaque and docked to the bottom,
   * so a doubled veil only shows in the strip above it. A card floats in the
   * middle, where there is nothing to hide it.
   */
  veil?: "full" | "soft";
  /** The choices, stacked — buttons, usually. */
  children: ReactNode;
};

/**
 * A question asked in the middle of the screen.
 *
 * The app answers almost everything with a bottom sheet, which is the right
 * place for filling something in: it rises from the thumb. A dialogue is for a
 * fork in the road — two or three ways to go, one tap, and nothing else
 * touchable until it is answered. Those are worth interrupting for, and the
 * middle of the screen is where an interruption belongs.
 */
/** The fade in and out, matching the dimming of a sheet. */
const FADE = 160;

export function Dialog({
  visible,
  onClose,
  onClosed,
  title,
  hint,
  dismissLabel = "Annuler",
  onDismiss,
  centred = false,
  veil = "full",
  children,
}: DialogProps) {
  // Read through a ref, like `Sheet` does: listing the callback among the
  // effect's dependencies would replay the exit every time the caller renders.
  const closed = useRef(onClosed);
  closed.current = onClosed;

  /** Kept mounted through the fade out, then torn down. */
  const [mounted, setMounted] = useState(visible);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        duration: FADE,
        useNativeDriver: false,
      }).start();
      return;
    }

    // Nothing to fade away on first render of a closed card.
    if (!mounted) return;

    Animated.timing(fade, {
      toValue: 0,
      duration: FADE,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      closed.current?.();
    });
    // `mounted` is read, not tracked: adding it would re-run the exit on
    // unmount — the same reasoning as in `Sheet`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fade]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* The veil and the card fade together, driven here rather than by the
          modal: see `onClosed` for why that matters. */}
      <Animated.View
        style={[
          styles.fill,
          veil === "soft" ? styles.veilSoft : styles.veilFull,
          { opacity: fade },
        ]}
      >
        {/* The backdrop is a sibling of the card, never its parent: a Pressable
            wrapped round the card swallows the touches meant for the buttons.

            Keyboard-aware, because some of these cards ask for a password: the
            padding grows from the bottom and lifts the centred card clear of
            the keyboard instead of leaving its buttons underneath. */}
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
          <View style={styles.card}>
            <Grain />

            <View
              style={
                title === undefined
                  ? styles.headerBare
                  : centred
                    ? styles.headerCentred
                    : styles.header
              }
            >
              {title === undefined ? null : centred ? (
                /* The sheets' own heading, not a centred imitation of this
                   one: that is what makes the two read as the same app. Its
                   `hint` is left to the card below, which is wider than a
                   sheet's inset and holds a long sentence better. */
                <JournalTitle title={title} />
              ) : (
                <View style={styles.heading}>
                  <Text style={styles.title}>{title}</Text>
                  <View style={styles.underline} />
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.close,
                  // Out of the row when centred: a 32-point button sharing
                  // the line would push the title's middle 16 points left of
                  // the card's, which is exactly the thing being fixed.
                  //
                  // Only with a title, though: lifted out of a header that
                  // holds nothing else, it would float over a row of no
                  // height and land on top of the content.
                  centred && title !== undefined && styles.closeFloat,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.closeGlyph}>×</Text>
              </Pressable>
            </View>

            {hint === undefined ? null : (
              <Text style={[styles.hint, centred && styles.hintCentred]}>
                {hint}
              </Text>
            )}

            {/* Nothing here carries `grow`: that is `flex: 1`, meant to fill
                a row. In a column sized by its content it gives each child a
                basis of nothing, and they spill out of the card. Stretching
                to the full width happens on its own. */}
            <View style={styles.choices}>{children}</View>

            {dismissLabel === null ? null : (
              <InkButton
                label={dismissLabel}
                variant="quiet"
                onPress={onDismiss ?? onClose}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  veilFull: { backgroundColor: BACKDROP },
  veilSoft: { backgroundColor: BACKDROP_SOFT },
  card: {
    width: "100%",
    maxWidth: 380,
    gap: space.sm,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: palette.paperLight,
    // Clipped so the grain keeps to the rounded corners, and edged so the
    // card reads as a sheet of paper rather than a floating rectangle.
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.paperDeep,
    ...shadow.lifted,
  },
  /** The cross sits level with the title, whatever the title wraps to. */
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  /** No row at all: the heading takes the full width so its centre is the
      card's, and the cross is lifted out of the flow above it. */
  headerCentred: { position: "relative" },
  /** Untitled: the cross alone, on its own line, pulled into the padding. */
  headerBare: { flexDirection: "row", justifyContent: "flex-end" },
  heading: { flex: 1, gap: space.xs },
  title: { ...type.plate, fontSize: 22, color: palette.ink },
  /** Hand-drawn under the words, not ruled across the card. */
  underline: {
    height: 3,
    width: "58%",
    minWidth: 56,
    marginTop: 3,
    borderRadius: radius.pill,
    backgroundColor: palette.paperDeep,
  },
  hint: { ...type.caption, color: palette.inkSoft, marginTop: space.xs },
  hintCentred: { textAlign: "center" },
  close: {
    width: 32,
    height: 32,
    marginTop: -4,
    marginRight: -4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  /** Pulled into the card's own padding, level with the first line of type. */
  closeFloat: { position: "absolute", top: -4, right: -4, marginTop: 0, marginRight: 0 },
  closeGlyph: { fontSize: 24, lineHeight: 28, color: palette.inkFaint, marginTop: -2 },
  pressed: { opacity: 0.6 },
  choices: { gap: space.sm, marginTop: space.xs, marginBottom: space.xs },
});
