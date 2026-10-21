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
  /**
   * What the taking button says — "Copier le territoire".
   *
   * Named rather than just "Copier", because this bar can be reached three
   * panels deep into the catalogue and the map behind it gives no clue which
   * kind of thing is being offered.
   */
  take: string;
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
  take,
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
          <InkButton
            label="Fermer"
            variant="tonal"
            grow
            onPress={onClose}
          />
          {takeable ? (
            <InkButton
              label={busy ? "…" : take}
              variant="solid"
              grow
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
  bar: { position: "absolute", left: space.lg, right: space.lg },
  /* Six points, et non les dix des deux autres viseurs : il y a ici un nom
     **et** sa ligne de précisions, qui vont ensemble et se serrent. L'écart
     avant les boutons reste de dix, la rangée portant les quatre points qui
     manquent — voir `actions`. */
  inner: { padding: space.md, gap: 6 },
  name: { ...type.plate, fontSize: 18, color: palette.ink },
  said: { ...type.caption, color: palette.inkSoft },
  /**
   * À parts égales sur toute la largeur, comme les deux autres viseurs.
   *
   * « Fermer » pèse donc autant que le bouton qui prend le territoire. C'est
   * un choix assumé : les trois barres se posent au même endroit de l'écran
   * et doivent répondre au doigt de la même façon, ce qui vaut mieux qu'une
   * hiérarchie exacte obtenue par une mise à part.
   *
   * Sans territoire à prendre, « Fermer » reste seul et prend toute la
   * largeur — ce qui est juste, étant alors la seule chose à faire.
   */
  actions: {
    flexDirection: "row",
    gap: space.sm,
    paddingTop: space.xs,
  },
});
