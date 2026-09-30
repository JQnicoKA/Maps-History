import { StyleSheet, Text, View } from "react-native";

import { Chip, InkButton, Paper } from "../../components/ui";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

/** The radii offered, in metres. A day's ride, and three steps out. */
export const RADII = [50_000, 200_000, 500_000, 2_000_000];

export type RegionReticleProps = {
  metres: number;
  onMetresChange: (metres: number) => void;
  /** How many screen points a metre is worth right now — null while unknown. */
  pointsPerMetre: number | null;
  onConfirm: () => void;
  onCancel: () => void;
  bottomInset: number;
};

/**
 * A place and how far around it, chosen where it can be seen.
 *
 * The radius was a row of distances in a filter panel, which is the one thing
 * a number cannot convey: "five hundred kilometres" means nothing until it is
 * drawn over the coastlines, and whether it holds one city or six countries
 * is the only thing the reader actually wants to know.
 *
 * The circle is drawn in screen points rather than as a shape on the map, and
 * that is not a shortcut — the centre *is* the crosshair, so the circle never
 * moves relative to it while the plate is dragged. Only zooming changes its
 * size, and the screen is where that change is felt.
 */
export function RegionReticle({
  metres,
  onMetresChange,
  pointsPerMetre,
  onConfirm,
  onCancel,
  bottomInset,
}: RegionReticleProps) {
  const radius = pointsPerMetre === null ? null : metres * pointsPerMetre;

  return (
    <>
      <View pointerEvents="none" style={styles.centre}>
        {radius === null ? null : (
          <View
            style={[
              styles.ring,
              {
                width: radius * 2,
                height: radius * 2,
                borderRadius: radius,
                marginLeft: -radius,
                marginTop: -radius,
              },
            ]}
          />
        )}
        <View style={styles.horizontal} />
        <View style={styles.vertical} />
        <View style={styles.pip} />
      </View>

      <Paper style={[styles.bar, { bottom: bottomInset + 16 }]}>
        <View style={styles.barInner}>
          <Text style={styles.hint}>
            Amenez le centre sous le réticule, puis choisissez la portée.
          </Text>
          <View style={styles.radii}>
            {RADII.map((one) => (
              <Chip
                key={one}
                label={one >= 1000_000 ? `${one / 1000_000} 000 km` : `${one / 1000} km`}
                selected={one === metres}
                onPress={() => onMetresChange(one)}
              />
            ))}
          </View>
          <View style={styles.actions}>
            <InkButton label="Annuler" variant="quiet" onPress={onCancel} />
            <InkButton label="Confirmer" variant="solid" onPress={onConfirm} />
          </View>
        </View>
      </Paper>
    </>
  );
}

const ARM = 26;

const styles = StyleSheet.create({
  centre: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  /**
   * The reach, drawn from the crosshair outward.
   *
   * Dashed and unfilled: a filled disc would hide the very coastlines the
   * reader is judging it against.
   */
  ring: {
    position: "absolute",
    left: "50%",
    top: "50%",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: palette.wax,
  },
  horizontal: {
    position: "absolute",
    width: ARM * 2,
    height: 1,
    backgroundColor: palette.wax,
  },
  vertical: {
    position: "absolute",
    width: 1,
    height: ARM * 2,
    backgroundColor: palette.wax,
  },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.wax,
  },
  bar: { position: "absolute", left: 16, right: 16 },
  barInner: { padding: 12, gap: 10 },
  hint: { ...type.legend, color: palette.inkSoft, textAlign: "center" },
  radii: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space.sm,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
});
