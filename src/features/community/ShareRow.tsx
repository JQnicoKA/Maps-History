import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { TickRow, useNotice } from "../../components/ui";
import { palette } from "../../theme/palette";
import { radius, space } from "../../theme/tokens";

export type ShareRowProps = {
  /** What this is, said in the line: "cet événement", "ce personnage"… */
  what: string;
  shared: boolean;
  onChange: (shared: boolean) => Promise<void>;
  /**
   * Why there is no choice here, when there is none — see `whyLocked`.
   *
   * Shown in place of the usual line, with the tick out of reach. Saying
   * nothing and simply greying the row would leave the reader guessing; the
   * rule is defensible, so it is stated.
   */
  locked?: string | null;
};

/**
 * Whether this belongs to the community.
 *
 * Ticked by default, everywhere, because that is the app's posture: what is
 * written here is history rather than a diary, and history nobody shares is
 * history nobody reads. Untick it and the thing stays entirely yours — off
 * every search, uncopiable, invisible to everyone.
 *
 * Put at the foot of a card rather than in the middle of a form: it is not a
 * field to fill in, it is a thing that is already true and can be undone.
 */
export function ShareRow({
  what,
  shared,
  onChange,
  locked = null,
}: ShareRowProps) {
  const [busy, setBusy] = useState(false);
  const { say, dialog } = useNotice();

  return (
    <View style={styles.frame}>
      {dialog}
      <TickRow
        title="Partagé avec la communauté"
        detail={
          locked !== null
            ? locked
            : busy
              ? "…"
              : shared
                ? `Les autres peuvent lire ${what} et en prendre copie.`
                : `${what.charAt(0).toUpperCase()}${what.slice(1)} n'appartient qu'à vous.`
        }
        on={shared}
        disabled={busy || locked !== null}
        onToggle={() => {
          setBusy(true);
          void onChange(!shared)
            .catch((cause: unknown) =>
              say(
                "Changement impossible",
                cause instanceof Error ? cause.message : String(cause),
              ),
            )
            .finally(() => setBusy(false));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** Set apart: what follows is about everybody else, not about this card. */
  frame: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
});
