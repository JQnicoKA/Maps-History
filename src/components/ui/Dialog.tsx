import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { InkButton } from "./InkButton";
import { palette } from "../../theme/palette";
import { BACKDROP, radius, shadow, space, type } from "../../theme/tokens";

export type DialogProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** A line under the title, when the choice needs one. */
  hint?: string;
  /** The way out. Give it `null` to leave the card without one. */
  dismissLabel?: string | null;
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
export function Dialog({
  visible,
  onClose,
  title,
  hint,
  dismissLabel = "Annuler",
  children,
}: DialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* The backdrop is a sibling of the card, never its parent: a Pressable
          wrapped round the card swallows the touches meant for the buttons. */}
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {hint === undefined ? null : <Text style={styles.hint}>{hint}</Text>}

          {/* Nothing here carries `grow`: that is `flex: 1`, meant to fill a
              row. In a column sized by its content it gives each child a basis
              of nothing, and they spill out of the card. Stretching to the
              full width happens on its own. */}
          <View style={styles.choices}>{children}</View>

          {dismissLabel === null ? null : (
            <InkButton label={dismissLabel} variant="quiet" onPress={onClose} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    backgroundColor: BACKDROP,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    gap: space.sm,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: palette.paperLight,
    ...shadow.lifted,
  },
  title: { ...type.heading, fontWeight: "700", color: palette.ink },
  hint: { ...type.caption, color: palette.inkSoft },
  choices: { gap: space.sm, marginTop: space.xs, marginBottom: space.xs },
});
