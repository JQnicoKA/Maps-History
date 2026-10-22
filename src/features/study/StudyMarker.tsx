import { Marker } from "@maplibre/maplibre-react-native";
import { StyleSheet, Text, View } from "react-native";

import type { Quarry } from "./subjects";
import { formatDateYear } from "../events/historicalDate";
import { describeType } from "../events/types";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

/** Le médaillon du lecteur en cours, à la taille d'un marqueur courant. */
const LOCKET = 70;

export type StudyMarkerProps = {
  subject: Quarry;
};

/**
 * Le marqueur d'une question, et ses dates sous lui.
 *
 * **Un marqueur à part, et non celui de la carte.** Celui de la collection
 * montre la première photographie de l'événement quand il y en a une, et porte
 * son titre en étiquette d'accessibilité : l'un et l'autre donnent la réponse
 * avant qu'on ait réfléchi — une photographie de la tour Eiffel ne laisse rien
 * à deviner. Celui-ci ne montre jamais qu'un glyphe et des dates, qui sont
 * exactement l'énoncé : « qu'est-ce qui s'est passé là, cette année-là ? »
 *
 * Insensible au doigt : il n'y a rien à ouvrir, et une tuile qui s'ouvrirait
 * sous la main porterait le nom cherché.
 */
export function StudyMarker({ subject }: StudyMarkerProps) {
  if (subject.kind === "territory") return null;

  const place =
    subject.kind === "event"
      ? ([subject.event.longitude, subject.event.latitude] as [number, number])
      : ([
          subject.person.longitude ?? 0,
          subject.person.latitude ?? 0,
        ] as [number, number]);

  /**
   * Ce qui s'écrit sous le médaillon.
   *
   * Pour un événement, sa période ; pour quelqu'un, ses années. Les dates
   * approximatives gardent leur tilde : une étude qui arrondirait « vers 1066 »
   * en « 1066 » enseignerait une fausse précision.
   */
  const dates =
    subject.kind === "event"
      ? subject.event.end === null
        ? formatDateYear(subject.event.start)
        : `${formatDateYear(subject.event.start)} – ${formatDateYear(subject.event.end)}`
      : subject.person.death === null
        ? `né en ${formatDateYear(subject.person.birth!)}`
        : `${formatDateYear(subject.person.birth!)} – ${formatDateYear(subject.person.death)}`;

  return (
    <Marker lngLat={place}>
      <View style={styles.stack} pointerEvents="none">
        <View style={styles.locket}>
          <Text style={styles.glyph}>
            {subject.kind === "event"
              ? describeType(subject.event.type).emoji
              : "👤"}
          </Text>
        </View>
        {/* Une étiquette posée sous le médaillon, pas dedans : dedans, elle
            aurait rétréci le glyphe, et c'est le glyphe qui dit de quelle
            espèce de chose il s'agit. */}
        <View style={styles.label}>
          <Text style={styles.dates}>{dates}</Text>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: "center", gap: space.xs },
  /** Le médaillon de parchemin de la carte, cerclé de cire comme le courant. */
  locket: {
    width: LOCKET,
    height: LOCKET,
    borderRadius: LOCKET / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: palette.paperLight,
    borderWidth: 3,
    borderColor: palette.wax,
    ...shadow.plate,
  },
  glyph: { fontSize: LOCKET * 0.42 },
  label: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...shadow.soft,
  },
  dates: {
    ...type.caption,
    fontWeight: "700",
    color: palette.ink,
  },
});
