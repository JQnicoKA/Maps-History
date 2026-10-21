/**
 * What a brush stroke is worth on the ground.
 *
 * The brush is chosen in screen points — a thumb is a thumb whatever the map
 * shows — but it is saved in metres, because a territory keeps its size when
 * the reader zooms out. The conversion is Web Mercator's, and it depends on
 * the latitude: a degree of longitude is 111 km at the equator and none at
 * the pole, so the same swipe covers far less ground in Norway than in Kenya.
 */

/**
 * Mètres par point d'écran au zoom 0, sur l'équateur.
 *
 * **Ce n'est pas 156 543, et c'était un vrai défaut.** Cette valeur-là est
 * la circonférence de la Terre divisée par 256 : la convention des tuiles de
 * l'ancien schéma XYZ. MapLibre définit son zoom sur des tuiles de **512**,
 * donc un point d'écran y vaut la moitié — 40 075 017 / 512.
 *
 * Ce que l'erreur coûtait : un pinceau de trente-quatre points enregistrait
 * un territoire large de soixante-huit. Personne ne pouvait s'en apercevoir,
 * puisqu'on ne voyait jamais le trait et le territoire en même temps — ils
 * n'ont été mis côte à côte que le jour où l'on a pu reprendre un dessin, et
 * la trace est alors apparue entourant les traits d'un halo d'une demi-
 * largeur de pinceau de chaque côté. Exactement le double.
 *
 * Les territoires déjà peints gardent la forme qu'ils ont ; ce sont les
 * prochains qui seront fidèles à ce qu'on peint.
 */
const EQUATOR = 40075016.686 / 512;

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
/**
 * Ce qu'un coup de cette largeur au sol mesurerait à l'écran, au zoom zéro.
 *
 * Mercator double les distances à l'écran à chaque niveau de zoom, donc une
 * largeur constante au sol est une largeur qui double elle aussi. En donner
 * la valeur au zoom zéro suffit : la carte retrouve toutes les autres en
 * multipliant par deux puissance le zoom — voir `BrushLayers`.
 *
 * C'est ce qui permet de rouvrir un dessin à n'importe quelle échelle et d'y
 * voir les traits à la largeur qu'ils ont vraiment, et non à celle du
 * pinceau du moment.
 */
/**
 * Ce qu'un point d'écran vaut au sol, là où la planche regarde.
 *
 * Exporté parce que la carte en a besoin pour une autre raison — dessiner un
 * rayon de recherche en mètres comme un cercle en points — et qu'elle en
 * tenait sa propre copie, avec la même constante erronée. Une seule source,
 * donc une seule correction.
 */
export function metresPerPoint(zoom: number, latitude: number): number {
  return (EQUATOR * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
}

export function brushAtZoomZero(metres: number, latitude: number): number {
  return (2 * metres) / (EQUATOR * Math.cos((latitude * Math.PI) / 180));
}

export function brushMetres(zoom: number, latitude: number): number {
  return Math.max((BRUSH_POINTS / 2) * metresPerPoint(zoom, latitude), 1);
}

/**
 * Le même pinceau, mesuré dans l'espace où l'écran le dessine.
 *
 * Mercator étire les distances d'un facteur `1 / cos(latitude)`, et c'est
 * exactement ce que `brushMetres` défait pour rendre des mètres au sol. Ici
 * on garde l'étirement : un disque de ce rayon-là est le disque que le doigt
 * couvre à l'écran, où qu'on soit sur la planche.
 *
 * La gomme s'en sert, parce qu'elle raisonne en ce que le doigt recouvre et
 * non en kilomètres. Et si ce nombre était faux, elle mordrait seulement
 * trop ou trop peu : rien de ce qui part au serveur n'en dépend.
 */
export function brushMercator(zoom: number): number {
  return Math.max((BRUSH_POINTS / 2) * (EQUATOR / 2 ** zoom), 1);
}
