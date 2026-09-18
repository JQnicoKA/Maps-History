import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { Dialog, GlyphButton, InkButton, SegmentedControl } from "../../components/ui";
import { useAuth } from "../../features/auth";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

const PROFILE = require("../../../assets/icons/profile.png");

export type ScreenView = "map" | "list";

const VIEWS = [
  { value: "map" as const, label: "Carte", icon: require("../../../assets/icons/view-map.png") },
  { value: "list" as const, label: "Liste", icon: require("../../../assets/icons/view-list.png") },
];

export type AccountButtonProps = {
  view: ScreenView;
  onChange: (view: ScreenView) => void;
};

/**
 * The only button in the top-left corner: who you are, and how you are looking.
 *
 * The two used to be separate — a toggle that flipped between map and list, and
 * an account disc beside it. Two buttons for two rare decisions, in the corner
 * where the map is worth seeing. They are one now.
 *
 * **One dialogue, two faces, and that is not a style choice.** iOS will not
 * present a modal from a controller that is already presenting one: a
 * confirmation opened *over* this card never appeared, and pressing "Se
 * déconnecter" did nothing at all. So the card changes what it holds instead of
 * putting a second card on top of itself.
 */
export function AccountButton({ view, onChange }: AccountButtonProps) {
  const { account, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  /** Whether the card is showing the account or asking to leave it. */
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setAsking(false);
    setProblem(null);
  };

  const leave = async () => {
    setBusy(true);
    setProblem(null);
    try {
      // On success there is nothing to tidy: the whole screen is replaced by
      // the sign-in one, this component included.
      await signOut();
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : String(cause));
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <GlyphButton accessibilityLabel="Votre compte" onPress={() => setOpen(true)}>
        <Image source={PROFILE} style={styles.glyph} resizeMode="contain" />
      </GlyphButton>

      <Dialog
        visible={open}
        onClose={close}
        title={asking ? "Se déconnecter ?" : "Votre compte"}
        hint={asking ? "Il faudra vous reconnecter." : account?.email}
        dismissLabel={null}
      >
        {asking ? (
          // Side by side, and the way out carries a background of its own:
          // between two answers to one question, neither should look like an
          // afterthought.
          <View style={styles.answers}>
            <InkButton
              label="Annuler"
              variant="tonal"
              grow
              disabled={busy}
              onPress={() => setAsking(false)}
            />
            <InkButton
              label={busy ? "…" : "Confirmer"}
              variant="solid"
              tone="danger"
              grow
              disabled={busy}
              onPress={() => void leave()}
            />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.legend}>Vue</Text>
              <SegmentedControl
                segments={VIEWS}
                value={view}
                onChange={(next) => {
                  onChange(next);
                  close();
                }}
              />
            </View>

            {problem === null ? null : (
              <Text style={styles.problem}>{problem}</Text>
            )}

            <InkButton
              label="Se déconnecter"
              variant="solid"
              tone="danger"
              onPress={() => setAsking(true)}
            />
          </>
        )}
      </Dialog>
    </>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 22, height: 22 },
  section: { gap: space.sm },
  answers: { flexDirection: "row", gap: space.sm },
  legend: { ...type.legend, color: palette.inkSoft },
  problem: { ...type.caption, color: palette.danger },
});
