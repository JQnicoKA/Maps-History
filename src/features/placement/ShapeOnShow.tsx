import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { FeatureCollection, Geometry } from "geojson";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { InkButton, Paper } from "../../components/ui";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

export type ShapeOnShowProps = {
  /** A GeoJSON geometry, as the database handed it over. */
  shape: unknown;
};

/**
 * Somebody else's territory, laid on the plate.
 *
 * A territory is nothing but its outline, so no card can show one: whether it
 * covers a duchy or half a continent is a question about coastlines, and only
 * the map answers it. Painted above the reader's own washes and outlined,
 * because it is a proposal rather than part of the world yet.
 */
export function ShapeOnShow({ shape }: ShapeOnShowProps) {
  const drawn = useMemo<FeatureCollection | null>(() => {
    if (shape === null || typeof shape !== "object") return null;
    return {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: shape as Geometry },
      ],
    };
  }, [shape]);

  if (drawn === null) return null;

  return (
    <GeoJSONSource id="shape-on-show" data={drawn}>
      <Layer
        id="shape-on-show-fill"
        type="fill"
        paint={{ "fill-color": palette.wax, "fill-opacity": 0.35 }}
      />
      {/* Outlined, unlike the territories of the map itself: this one is
          being offered, and the line is what says it is not yet yours. */}
      <Layer
        id="shape-on-show-line"
        type="line"
        paint={{
          "line-color": palette.waxDeep,
          "line-width": 2,
          "line-dasharray": [3, 2],
        }}
      />
    </GeoJSONSource>
  );
}

export type ShapeBarProps = {
  name: string;
  said: string;
  takeable: boolean;
  busy: boolean;
  onTake: () => void;
  onClose: () => void;
  bottomInset: number;
};

/** What is being shown, and the two things to do about it. */
export function ShapeBar({
  name,
  said,
  takeable,
  busy,
  onTake,
  onClose,
  bottomInset,
}: ShapeBarProps) {
  return (
    <Paper style={[styles.bar, { bottom: bottomInset + 16 }]}>
      <View style={styles.inner}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.said}>{said}</Text>
        <View style={styles.actions}>
          <InkButton label="Fermer" variant="quiet" onPress={onClose} />
          {takeable ? (
            <InkButton
              label={busy ? "…" : "Copier"}
              variant="solid"
              disabled={busy}
              onPress={onTake}
            />
          ) : null}
        </View>
      </View>
    </Paper>
  );
}

const styles = StyleSheet.create({
  bar: { position: "absolute", left: 16, right: 16 },
  inner: { padding: 12, gap: 6 },
  name: { ...type.plate, fontSize: 18, color: palette.ink },
  said: { ...type.legend, color: palette.inkSoft },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: space.sm,
    paddingTop: space.xs,
  },
});
