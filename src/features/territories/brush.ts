/**
 * What a brush stroke is worth on the ground.
 *
 * The brush is chosen in screen points — a thumb is a thumb whatever the map
 * shows — but it is saved in metres, because a territory keeps its size when
 * the reader zooms out. The conversion is Web Mercator's, and it depends on
 * the latitude: a degree of longitude is 111 km at the equator and none at
 * the pole, so the same swipe covers far less ground in Norway than in Kenya.
 */

/** Metres per screen point at zoom 0, on the equator — Web Mercator's constant. */
const EQUATOR = 156543.03392;

/**
 * How wide the brush paints, in screen points. Roughly a fingertip: wide
 * enough that a shaky hand still gives a clean band, narrow enough to follow
 * a coastline at country zoom.
 */
export const BRUSH_POINTS = 34;

/**
 * The brush's radius on the ground, in metres.
 *
 * Half the width, because `ST_Buffer` grows a line outwards on both sides:
 * a radius of `r` gives a band `2r` across, which is what was drawn.
 */
export function brushMetres(zoom: number, latitude: number): number {
  const perPoint = (EQUATOR * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
  return Math.max((BRUSH_POINTS / 2) * perPoint, 1);
}
