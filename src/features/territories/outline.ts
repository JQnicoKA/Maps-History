/**
 * A shape reduced to bands, so it can be drawn without a drawing library.
 *
 * A territory's only picture is its own outline, and React Native cannot draw
 * one: there is no canvas and no SVG without a native module. So the outline
 * is scanned into a few dozen horizontal spans — the classic even-odd fill —
 * and each span becomes a plain view. A silhouette rather than a map, which
 * is all a thumbnail the size of a thumbnail can honestly be.
 *
 * Everything here is in the 0..1 square: the caller multiplies by however
 * many points it has. Longitude grows right and latitude grows *up*, so the
 * bands are counted from the top, which is where a screen starts.
 */

/** One horizontal run of the shape, in the unit square. */
export type Band = { top: number; left: number; width: number };

type Ring = [number, number][];

/** Every outer ring of a Polygon or a MultiPolygon, holes ignored. */
function ringsOf(shape: unknown): Ring[] {
  if (shape === null || typeof shape !== "object") return [];
  const { type, coordinates } = shape as {
    type?: string;
    coordinates?: unknown;
  };
  // Holes are dropped on purpose: at this size a lake reads as noise, and
  // the even-odd rule would need every ring in one pass to honour them.
  if (type === "Polygon") {
    const rings = coordinates as Ring[] | undefined;
    return rings?.[0] ? [rings[0]] : [];
  }
  if (type === "MultiPolygon") {
    const parts = coordinates as Ring[][] | undefined;
    return (parts ?? []).flatMap((part) => (part[0] ? [part[0]] : []));
  }
  return [];
}

/** The smallest box holding every ring, or null when there is nothing. */
function boundsOf(rings: Ring[]) {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < west) west = x;
      if (x > east) east = x;
      if (y < south) south = y;
      if (y > north) north = y;
    }
  }
  if (west === Infinity) return null;
  return { west, east, south, north };
}

/**
 * Where a horizontal line at `y` crosses the rings, as pairs.
 *
 * The even-odd rule: sorted crossings alternate outside/inside, so the first
 * and second bound a filled run, the third and fourth the next, and so on.
 * A vertex exactly on the line is counted once — the half-open test
 * `(y0 <= y) !== (y1 <= y)` is what avoids counting it twice and tearing a
 * hole through the silhouette.
 */
function crossings(rings: Ring[], y: number): number[] {
  const at: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const [x0, y0] = a;
      const [x1, y1] = b;
      if (y0 === y1) continue;
      if ((y0 <= y) !== (y1 <= y)) {
        at.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
      }
    }
  }
  return at.sort((one, two) => one - two);
}

/**
 * The bands that make up a shape, in the unit square.
 *
 * `count` is how many rows to scan; each band is measured at the middle of
 * its row, which is why a shape narrower than one band can still show. A
 * shape with no area at all comes back empty, and the caller draws nothing
 * rather than a misleading square.
 */
export function outline(shape: unknown, count = 18): Band[] {
  const rings = ringsOf(shape);
  const box = boundsOf(rings);
  if (box === null) return [];

  const width = box.east - box.west;
  const height = box.north - box.south;
  if (width <= 0 || height <= 0) return [];

  const bands: Band[] = [];
  const step = 1 / count;

  for (let row = 0; row < count; row++) {
    // Latitude grows upward and rows are counted downward.
    const y = box.north - height * ((row + 0.5) / count);
    const at = crossings(rings, y);
    for (let pair = 0; pair + 1 < at.length; pair += 2) {
      const left = (at[pair]! - box.west) / width;
      const right = (at[pair + 1]! - box.west) / width;
      if (right - left <= 0) continue;
      bands.push({ top: row * step, left, width: right - left });
    }
  }
  return bands;
}
