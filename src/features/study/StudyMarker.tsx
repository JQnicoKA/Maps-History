import { Marker } from "@maplibre/maplibre-react-native";
import { StyleSheet, Text, View } from "react-native";

import { boxAround, cornersOf, latitudeAt, mercatorY } from "./frame";
import type { Quarry } from "./subjects";
import { BORDERS_END } from "../../config/history";
import { formatDateYear, formatYear } from "../events/historicalDate";
import type { TerritoryFeature } from "../territories/api";
import { describeType } from "../events/types";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

/** Le médaillon du lecteur en cours, à la taille d'un marqueur courant. */
const LOCKET = 70;

export type StudyMarkerProps = {
  subject: Quarry;
  /**
   * La forme du territoire demandé, quand c'en est un.
   *
   * Elle sert ici à une seule chose : trouver le milieu de ce qu'on voit,
   * pour y poser les dates. Un territoire n'a pas de marqueur — la forme est
   * la question —, mais il a des dates, et elles font partie de l'énoncé
   * autant que pour un événement.
   */
  shape?: TerritoryFeature | null;
};

/**
 * Les années d'un territoire, en trois mots au plus.
 *
 * Les mêmes trois cas que sa fiche, dites plus court parce qu'une étiquette
 * sur la planche n'est pas une phrase. **`depuis` n'est pas une coquetterie** :
 * trois cent quatre-vingt-quatre entités du fond de carte finissent en 2024,
 * qui n'est pas l'année où elles sont tombées mais celle où les données
 * s'arrêtent. Écrire « 1991 – 2024 » inventerait un effondrement, et une
 * étude a moins le droit qu'ailleurs d'enseigner une chose fausse.
 */
function territoryYears(from: number, to: number): string {
  if (from === to) return formatYear(from);
  if (to >= BORDERS_END) return `depuis ${formatYear(from)}`;
  return `${formatYear(from)} – ${formatYear(to)}`;
}

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
export function StudyMarker({ subject, shape = null }: StudyMarkerProps) {
  if (subject.kind === "territory") {
    if (shape === null) return null;

    /* Le milieu de ce qu'on voit, pris **en Mercator** : la moyenne de deux
       latitudes n'est pas le milieu de l'écran, et sur un territoire étiré du
       nord au sud l'étiquette se poserait de travers. Le même calcul que le
       cadrage, aux mêmes fonctions — voir `frame.ts`. */
    const box = boxAround(cornersOf(shape.geometry));
    if (box === null) return null;

    return (
      <Marker
        lngLat={[
          (box.west + box.east) / 2,
          latitudeAt((mercatorY(box.south) + mercatorY(box.north)) / 2),
        ]}
      >
        {/* Les dates seules, jamais le nom : le nom est la réponse. */}
        <View style={styles.label} pointerEvents="none">
          <Text style={styles.dates}>
            {territoryYears(subject.territory.from, subject.territory.to)}
          </Text>
        </View>
      </Marker>
    );
  }

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
        {/* Rond pour un événement, carré pour quelqu'un — la distinction de
            la carte elle-même, où les gens sont des camées et les événements
            des médaillons. Elle manquait ici : deux ronds identiques ne
            disaient pas de quelle espèce de chose on était en train de
            demander le nom, ce qui est pourtant la moitié de l'énoncé. */}
        <View
          style={[
            styles.locket,
            subject.kind === "event" ? styles.round : styles.square,
          ]}
        >
          {/* Jamais la photographie ni l'initiale, qui sont ce que la carte
              montre d'ordinaire : l'une et l'autre donnent la réponse — un
              « C » suffit à désigner Clovis parmi quatre noms. */}
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
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: palette.paperLight,
    borderWidth: 3,
    borderColor: palette.wax,
    ...shadow.plate,
  },
  round: { borderRadius: LOCKET / 2 },
  /**
   * Le camée des gens, à la proportion de celui de la carte.
   *
   * Là-bas, un camée fait quarante-six points et ses coins sont arrondis de
   * huit — soit un peu plus d'un sixième du côté. Ici le marqueur fait
   * soixante-dix, et douze tiennent le même rapport : c'est la même forme,
   * vue de plus près, et non une seconde idée du carré.
   */
  square: { borderRadius: radius.md },
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
