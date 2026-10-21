import type { Daub, Stroke } from "./drawn";

/**
 * La gomme : des ciseaux sur les traits, et non une gomme sur le papier.
 *
 * **Ce qui est effacé, ce sont des longueurs de trait.** Un trait n'est pas
 * stocké comme une bande mais comme une ligne de points, que l'affichage et
 * la base épaississent chacun de leur côté. Gommer revient donc à jeter les
 * points que la gomme a touchés : traverser un trait le coupe en deux,
 * frotter son bout le raccourcit, et passer dessus le fait disparaître.
 *
 * **C'est ce qui rend l'opération sûre.** Rien de la chaîne ne change :
 * l'aperçu dessine toujours les traits en lignes épaisses, le serveur les
 * épaissit toujours lui-même. La gomme ne touche qu'à la liste que les deux
 * lisent, donc ils ne peuvent pas se contredire — ils s'accordent pour
 * exactement la même raison qu'avant qu'elle existe.
 *
 * Le prix est dit une fois pour toutes : **on ne rabote pas un bord.**
 * Approcher le bord d'une bande, c'est approcher sa ligne centrale, donc en
 * retirer toute l'épaisseur. Pour affiner un contour, il faut gommer la
 * section et la repeindre.
 */

/** Le rayon de la Terre, en mètres : la constante de Web Mercator. */
const EARTH = 6378137;

type Flat = { x: number; y: number };

/** Longitude et latitude vers les mètres de Mercator. */
function project([lon, lat]: [number, number]): Flat {
  return {
    x: (lon * Math.PI * EARTH) / 180,
    y: Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * EARTH,
  };
}

/** Et le retour. */
function unproject({ x, y }: Flat): [number, number] {
  return [
    (x * 180) / (Math.PI * EARTH),
    (2 * Math.atan(Math.exp(y / EARTH)) - Math.PI / 2) * (180 / Math.PI),
  ];
}

/** Le point d'un segment le plus proche d'un autre point, et sa distance. */
function toSegment(p: Flat, a: Flat, b: Flat): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const span = dx * dx + dy * dy;
  // Deux points confondus : le segment est un point.
  if (span === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / span;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** La distance d'un point au chemin de la gomme, entière. */
function toPath(p: Flat, path: Flat[]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return Math.hypot(p.x - path[0]!.x, p.y - path[0]!.y);
  let best = Infinity;
  for (let i = 1; i < path.length; i += 1) {
    const d = toSegment(p, path[i - 1]!, path[i]!);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Où, entre deux points, la gomme cesse d'atteindre — par dichotomie.
 *
 * Sans cela le bord gommé serait en escalier : les points d'un trait sont
 * espacés de quatorze points d'écran pour un pinceau large de trente-quatre,
 * et la coupe tomberait sur le point le plus proche plutôt qu'à l'endroit
 * touché. Huit passes ramènent l'erreur à un deux-cent-cinquante-sixième de
 * l'écart, soit un vingtième de point d'écran.
 *
 * La distance à une ligne brisée n'a pas d'inverse simple ; on la cherche
 * donc plutôt que de la résoudre. Huit tours sur quelques dizaines de points
 * ne coûtent rien.
 */
function edge(kept: Flat, cut: Flat, path: Flat[], reach: number): Flat {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 8; i += 1) {
    const mid = (low + high) / 2;
    const at = {
      x: kept.x + (cut.x - kept.x) * mid,
      y: kept.y + (cut.y - kept.y) * mid,
    };
    if (toPath(at, path) < reach) high = mid;
    else low = mid;
  }
  return {
    x: kept.x + (cut.x - kept.x) * low,
    y: kept.y + (cut.y - kept.y) * low,
  };
}

/**
 * Passe la gomme sur ce qui est peint, et rend ce qui reste.
 *
 * `reach` est la distance en mètres de Mercator sous laquelle un point est
 * jeté. Elle vaut la somme des deux rayons — celui du pinceau et celui de la
 * gomme — car c'est à cette distance que leurs disques se touchent : la
 * bande effacée fait alors exactement la largeur de la gomme.
 *
 * Un trait traversé rend deux traits ; un trait entièrement couvert n'en
 * rend aucun. Un point isolé est conservé : la base en fait un disque, ce
 * qui est le reste légitime d'un trait raccourci jusqu'à son dernier pas.
 */
export function rub(
  strokes: Daub[],
  eraser: Stroke,
  reach: number,
): Daub[] {
  if (eraser.length === 0 || reach <= 0) return strokes;
  const path = eraser.map(project);

  const left: Daub[] = [];
  for (const stroke of strokes) {
    const here = stroke.points.map(project);
    const near = here.map((point) => toPath(point, path) < reach);

    let run: Flat[] = [];
    /* Chaque morceau garde la largeur du trait dont il vient : couper un
       coup de pinceau en deux donne deux coups du même pinceau, et non deux
       traits qui auraient oublié leur épaisseur. */
    const close = () => {
      if (run.length > 0) {
        left.push({ points: run.map(unproject), metres: stroke.metres });
      }
      run = [];
    };

    for (let i = 0; i < here.length; i += 1) {
      const point = here[i]!;
      if (!near[i]) {
        // Entrer dans ce qui reste : poser d'abord le bord exact derrière soi.
        if (i > 0 && near[i - 1]) {
          run.push(edge(point, here[i - 1]!, path, reach));
        }
        run.push(point);
        continue;
      }
      // Sortir : fermer sur le bord exact plutôt que sur le dernier point gardé.
      if (i > 0 && !near[i - 1]) {
        run.push(edge(here[i - 1]!, point, path, reach));
      }
      close();
    }
    close();
  }
  return left;
}
