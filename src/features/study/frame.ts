import type { MultiPolygon, Polygon } from "geojson";

/**
 * Où poser la caméra pour qu'une question se lise.
 *
 * Deux calculs, et aucun n'est négociable à l'œil : lever le sujet au-dessus
 * du milieu pour que les propositions ne le couvrent pas, et choisir une
 * échelle qui fasse tenir une forme dans la planche. Les deux passent par la
 * projection de Mercator, où un degré de latitude ne vaut pas partout la même
 * distance — c'est ce qui rend l'improvisation à l'œil fausse près des pôles.
 *
 * Module pur : il ne connaît ni MapLibre ni React, et s'éprouve donc sous
 * `vitest`, qui tourne sans configuration.
 */

/**
 * La tuile de MapLibre fait **512 points**, non 256.
 *
 * La leçon a déjà coûté un facteur deux au pinceau — voir `brush.ts`, où la
 * constante de l'équateur portait la même erreur. Toutes les échelles de cette
 * application se lisent sur 512.
 */
const TILE = 512;

/** La largeur du monde, en points, à une échelle donnée. */
export function worldPoints(zoom: number): number {
  return TILE * 2 ** zoom;
}

/**
 * La latitude, ramenée entre 0 et 1 du haut vers le bas de la planche.
 *
 * C'est l'ordonnée de Mercator, celle où les parallèles s'écartent à mesure
 * qu'on monte. Elle croît vers le **sud**, comme les pixels d'un écran : c'est
 * ce qui permet d'ajouter des points à une position sans changer de repère.
 */
export function mercatorY(latitude: number): number {
  const radians = (latitude * Math.PI) / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / (2 * Math.PI);
}

/** Le chemin du retour, de l'ordonnée de Mercator vers la latitude. */
export function latitudeAt(y: number): number {
  const radians = 2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2;
  return (radians * 180) / Math.PI;
}

/** Les bornes du monde que Mercator sait dessiner. */
const EDGE = 85.051129;

export type Point = { longitude: number; latitude: number };

/**
 * Le centre à viser pour que le sujet se pose **plus haut** que le milieu.
 *
 * La question occupe le bas de l'écran ; un marqueur au centre géométrique
 * serait à demi couvert par les propositions. On ne déplace donc pas le
 * marqueur — il est où il est, c'est tout l'intérêt — mais la caméra, qui
 * descend d'autant de points que le sujet doit monter.
 *
 * `lift` est en points d'écran, ce qui est la seule unité où la demande a du
 * sens : « un cinquième de la hauteur » ne se dit pas en degrés, et ce que
 * valent ces points en degrés dépend de l'échelle et de la latitude.
 */
export function lifted(point: Point, zoom: number, lift: number): Point {
  const span = worldPoints(zoom);
  // Vers le bas, puisque l'ordonnée croît vers le sud et que la caméra
  // descend pour que le sujet monte.
  const y = mercatorY(point.latitude) + lift / span;
  return {
    longitude: point.longitude,
    latitude: Math.max(-EDGE, Math.min(EDGE, latitudeAt(Math.min(1, Math.max(0, y))))),
  };
}

export type Box = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type Framing = { center: [number, number]; zoom: number };

/**
 * L'échelle à laquelle une forme tient dans la planche, et son milieu.
 *
 * Les deux dimensions sont essayées et la plus exigeante l'emporte : un
 * territoire large et plat doit tenir en largeur, un territoire haut et mince
 * en hauteur, et prendre la mauvaise des deux le ferait déborder.
 *
 * `fill` est la part de la planche que la forme occupe. Moins de un, toujours :
 * une forme qui touche les quatre bords ne se lit pas comme une forme, elle se
 * lit comme un fond.
 */
export function frameBox(
  box: Box,
  screen: { width: number; height: number },
  options: { fill?: number; lift?: number; min?: number; max?: number } = {},
): Framing {
  const { fill = 0.7, lift = 0, min = 0, max = 16 } = options;

  const acrossWorld = Math.abs(box.east - box.west) / 360;
  const downWorld = Math.abs(mercatorY(box.south) - mercatorY(box.north));

  /* Une forme sans étendue — un point, ou un territoire plus fin qu'un trait —
     n'impose aucune échelle : la borne haute décide alors, et non une division
     par zéro. */
  const forWidth =
    acrossWorld > 0
      ? Math.log2((screen.width * fill) / (TILE * acrossWorld))
      : max;
  const forHeight =
    downWorld > 0
      ? Math.log2((screen.height * fill) / (TILE * downWorld))
      : max;

  const zoom = Math.max(min, Math.min(max, Math.min(forWidth, forHeight)));

  /* Le milieu se prend **en Mercator** et non sur les latitudes : la moyenne
     de deux latitudes n'est pas le milieu de ce qu'on voit, et un territoire
     étiré du nord au sud se poserait de travers. */
  const middle = {
    longitude: (box.west + box.east) / 2,
    latitude: latitudeAt((mercatorY(box.south) + mercatorY(box.north)) / 2),
  };

  const placed = lift === 0 ? middle : lifted(middle, zoom, lift);
  return { center: [placed.longitude, placed.latitude], zoom };
}

/** Les bornes d'un semis de points — le tour d'une forme, aplatie. */
export function boxAround(points: readonly (readonly [number, number])[]): Box | null {
  if (points.length === 0) return null;

  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [longitude, latitude] of points) {
    if (longitude < west) west = longitude;
    if (longitude > east) east = longitude;
    if (latitude < south) south = latitude;
    if (latitude > north) north = latitude;
  }
  return { west, south, east, north };
}

/**
 * Tous les sommets d'une forme, à plat.
 *
 * Les trous d'un polygone sont parcourus comme son contour : ils sont dedans
 * par définition, donc les lire ne change pas les bornes — et les ignorer
 * demanderait de distinguer l'anneau extérieur des autres pour rien.
 */
export function cornersOf(
  geometry: Polygon | MultiPolygon,
): [number, number][] {
  const corners: [number, number][] = [];

  const walk = (rings: Polygon["coordinates"]) => {
    for (const ring of rings) {
      for (const point of ring) {
        const longitude = point[0];
        const latitude = point[1];
        if (longitude === undefined || latitude === undefined) continue;
        corners.push([longitude, latitude]);
      }
    }
  };

  if (geometry.type === "Polygon") walk(geometry.coordinates);
  else for (const part of geometry.coordinates) walk(part);

  return corners;
}
