import { useMemo } from "react";
import { Dimensions } from "react-native";

import {
  boxAround,
  cornersOf,
  frameBox,
  lifted,
  type Framing,
} from "./frame";
import type { StudySession } from "./useStudySession";
import { ZOOM } from "../../config/map";

/**
 * De combien le sujet monte au-dessus du milieu, en part de la hauteur.
 *
 * La question occupe le bas : quatre propositions, le bouton qui suit, et la
 * tuile qui s'ouvre une fois répondu — un bon tiers de l'écran. Un sujet posé
 * au centre géométrique serait à demi caché par elles au moment où on le
 * cherche. Un sixième de hauteur le pose à peu près au quart haut, ce qui lui
 * laisse de la carte tout autour : c'est le pourtour qui fait reconnaître un
 * lieu, pas le point.
 */
const LIFT = 1 / 6;

/**
 * L'échelle d'une question posée sur un point.
 *
 * Celle du pays : on voit la région et les côtes qui l'entourent, et il faut
 * les reconnaître. Plus près, la réponse se lirait sur les noms de villes du
 * fond de carte ; plus loin, un point au milieu d'un continent ne dirait rien.
 */
const POINT_ZOOM = ZOOM.country;

/**
 * Comment la planche se pose pour la question en cours.
 *
 * `null` quand il n'y a rien à cadrer — hors étude, ou le temps qu'une forme
 * de territoire arrive du serveur. La caméra garde alors ce qu'elle avait, ce
 * qui vaut mieux qu'un saut vers un cadrage provisoire.
 */
export function useStudyFraming(study: StudySession): Framing | null {
  const { live, subject, shape } = study;

  return useMemo(() => {
    if (!live || subject === null) return null;

    const screen = Dimensions.get("window");
    const lift = screen.height * LIFT;

    if (subject.kind === "territory") {
      if (shape === null) return null;
      const box = boxAround(cornersOf(shape.geometry));
      if (box === null) return null;
      /* Plus serré que le cadrage d'une forme ordinaire — 55 % de la planche
         et non 70 % — parce que le bas de l'écran est pris par la question :
         la part qui reste à la forme n'est pas la planche entière. */
      return frameBox(box, screen, {
        fill: 0.55,
        lift,
        min: ZOOM.min,
        max: ZOOM.max,
      });
    }

    const point =
      subject.kind === "event"
        ? {
            longitude: subject.event.longitude,
            latitude: subject.event.latitude,
          }
        : {
            longitude: subject.person.longitude ?? 0,
            latitude: subject.person.latitude ?? 0,
          };

    const placed = lifted(point, POINT_ZOOM, lift);
    return {
      center: [placed.longitude, placed.latitude],
      zoom: POINT_ZOOM,
    };
  }, [live, subject, shape]);
}
