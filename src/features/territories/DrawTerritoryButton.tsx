import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { useHidden } from "./HiddenProvider";
import { Dialog, GlyphButton, InkButton } from "../../components/ui";
import { formatYear } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

const PENCIL = require("../../../assets/icons/pencil-draw.png");

export type DrawTerritoryButtonProps = {
  /** Hands the map over to the brush. */
  onDraw: () => void;
};

/**
 * The plate's own button: what the reader has added to the map, and removed
 * from it.
 *
 * Under the `+`, and deliberately apart from it: one adds an event to the
 * collection, the other changes the map the collection is read on. Two
 * different kinds of making.
 */
export function DrawTerritoryButton({ onDraw }: DrawTerritoryButtonProps) {
  const { hidden, show, drawn, erase } = useHidden();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const work = (key: string, deed: Promise<void>) => {
    setBusy(key);
    void deed.finally(() => setBusy(null));
  };

  return (
    <>
      <GlyphButton
        accessibilityLabel="Territoires"
        onPress={() => setOpen(true)}
      >
        <Image source={PENCIL} style={styles.glyph} resizeMode="contain" />
      </GlyphButton>

      <Dialog
        visible={open}
        onClose={() => setOpen(false)}
        title="Territoires"
        hint="Ce que vous avez ajouté à la carte, et ce que vous en avez retiré."
        dismissLabel={null}
      >
        <InkButton
          label="Dessiner un territoire"
          variant="solid"
          onPress={() => {
            setOpen(false);
            onDraw();
          }}
        />

        {drawn.length === 0 ? null : (
          <View style={styles.section}>
            <Text style={styles.legend}>
              {drawn.length === 1
                ? "1 territoire dessiné"
                : `${drawn.length} territoires dessinés`}
            </Text>
            {drawn.map((one) => (
              <InkButton
                key={one.id}
                label={
                  busy === one.id
                    ? "…"
                    : `Effacer ${one.name} · ${formatYear(one.from)}–${formatYear(one.to)}`
                }
                variant="quiet"
                tone="danger"
                disabled={busy !== null}
                onPress={() => work(one.id, erase(one.id))}
              />
            ))}
          </View>
        )}

        {hidden.length === 0 ? null : (
          <View style={styles.section}>
            <Text style={styles.legend}>
              {hidden.length === 1
                ? "1 territoire retiré"
                : `${hidden.length} territoires retirés`}
            </Text>
            {hidden.map((name) => (
              <InkButton
                key={name}
                label={busy === name ? "…" : `Rétablir ${name}`}
                variant="tonal"
                disabled={busy !== null}
                onPress={() => work(name, show(name))}
              />
            ))}
          </View>
        )}
      </Dialog>
    </>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 22, height: 22 },
  section: { gap: space.sm, marginTop: space.xs },
  legend: { ...type.legend, color: palette.inkSoft },
});
