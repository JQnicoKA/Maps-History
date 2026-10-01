import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { outline } from "./outline";
import { palette } from "../../theme/palette";

export type SilhouetteProps = {
  /** A GeoJSON geometry, as the catalogue handed it over. */
  shape: unknown;
  size: number;
};

/**
 * A territory's outline, drawn without a drawing library.
 *
 * There is no canvas in React Native and no SVG without a native module, so
 * the shape is scanned into horizontal bands — see `silhouette.ts` — and each
 * band is a plain view. Eighteen of them at this size reads as the shape it
 * is: nobody mistakes Italy for Burgundy.
 *
 * A silhouette and not a map: no coastline behind it, no colour but the wax.
 * It says *what shape*, and the map itself is one tap away for the rest.
 */
export function Silhouette({ shape, size }: SilhouetteProps) {
  const bands = useMemo(() => outline(shape, BANDS), [shape]);
  if (bands.length === 0) return null;

  // A hair over, so consecutive bands meet instead of leaving a comb of gaps.
  const height = size / BANDS + 0.5;

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {bands.map((band, index) => (
        <View
          key={index}
          style={{
            position: "absolute",
            top: band.top * size,
            left: band.left * size,
            width: Math.max(band.width * size, 1),
            height,
            backgroundColor: palette.wax,
          }}
        />
      ))}
    </View>
  );
}

/**
 * How many rows the scan uses.
 *
 * Eighteen at fifty-four points is three points a band — fine enough that a
 * coast reads as a coast, coarse enough that a page of two dozen rows stays
 * a few hundred views rather than a few thousand.
 */
const BANDS = 18;

const styles = StyleSheet.create({
  /** Centred in its slot, and never spilling out of it. */
  frame: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
