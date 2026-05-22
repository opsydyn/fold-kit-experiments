// Delaunay triangulation and Voronoi diagrams
// Port of Delaunator (https://github.com/mapbox/delaunator, MIT)
// and d3-delaunay (https://github.com/d3/d3-delaunay, ISC)
//
// orient2d uses a simple cross product (non-robust) instead of robust-predicates.
// Fine for non-degenerate point sets; for production use over floating-point
// near-collinear inputs, swap in a robust orient2d.

// ──── Algorithm helpers ───────────────────────────────────────────────────────

const EPSILON = 2 ** -52;
const EDGE_STACK = new Uint32Array(512);

function orient2d(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function pseudoAngle(dx: number, dy: number): number {
  const p = dx / (Math.abs(dx) + Math.abs(dy));
  return (dy > 0 ? 3 - p : 1 + p) / 4;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

function inCircle(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
  px: number, py: number,
): boolean {
  const dx = ax - px, dy = ay - py;
  const ex = bx - px, ey = by - py;
  const fx = cx - px, fy = cy - py;
  const ap = dx * dx + dy * dy;
  const bp = ex * ex + ey * ey;
  const cp = fx * fx + fy * fy;
  return dx * (ey * cp - bp * fy) - dy * (ex * cp - bp * fx) + ap * (ex * fy - ey * fx) < 0;
}

function circumradius(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const ex = cx - ax, ey = cy - ay;
  const bl = dx * dx + dy * dy, cl = ex * ex + ey * ey;
  const d = 0.5 / (dx * ey - dy * ex);
  const x = (ey * bl - dy * cl) * d, y = (dx * cl - ex * bl) * d;
  return x * x + y * y;
}

function circumcenter(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
): readonly [number, number] {
  const dx = bx - ax, dy = by - ay;
  const ex = cx - ax, ey = cy - ay;
  const bl = dx * dx + dy * dy, cl = ex * ex + ey * ey;
  const d = 0.5 / (dx * ey - dy * ex);
  return [ax + (ey * bl - dy * cl) * d, ay + (dx * cl - ex * bl) * d];
}

function swap(arr: Uint32Array, i: number, j: number): void {
  const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
}

function quicksort(ids: Uint32Array, dists: Float64Array, left: number, right: number): void {
  if (right - left <= 20) {
    for (let i = left + 1; i <= right; i++) {
      const temp = ids[i];
      const tempDist = dists[temp];
      let j = i - 1;
      while (j >= left && dists[ids[j]] > tempDist) ids[j + 1] = ids[j--];
      ids[j + 1] = temp;
    }
    return;
  }
  const median = (left + right) >> 1;
  let i = left + 1, j = right;
  swap(ids, median, i);
  if (dists[ids[left]] > dists[ids[right]]) swap(ids, left, right);
  if (dists[ids[i]] > dists[ids[right]]) swap(ids, i, right);
  if (dists[ids[left]] > dists[ids[i]]) swap(ids, left, i);
  const temp = ids[i], tempDist = dists[temp];
  while (true) {
    do i++; while (dists[ids[i]] < tempDist);
    do j--; while (dists[ids[j]] > tempDist);
    if (j < i) break;
    swap(ids, i, j);
  }
  ids[left + 1] = ids[j]; ids[j] = temp;
  if (right - i + 1 >= j - left) {
    quicksort(ids, dists, i, right);
    quicksort(ids, dists, left, j - 1);
  } else {
    quicksort(ids, dists, left, j - 1);
    quicksort(ids, dists, i, right);
  }
}

// ──── Triangulation ───────────────────────────────────────────────────────────

export type Point2D = readonly [number, number];
export type Bounds = readonly [number, number, number, number]; // [x0, y0, x1, y1]

export type DelaunayResult = Readonly<{
  coords: Float64Array;
  triangles: Uint32Array;
  halfedges: Int32Array;
  hull: Uint32Array;
  inedges: Int32Array;
}>;

export function triangulate(points: ReadonlyArray<Point2D>): DelaunayResult {
  const n = points.length;
  const coords = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    coords[2 * i] = points[i][0];
    coords[2 * i + 1] = points[i][1];
  }

  const maxTri = Math.max(2 * n - 5, 0);
  const _triangles = new Uint32Array(maxTri * 3);
  const _halfedges = new Int32Array(maxTri * 3);
  const hashSize = Math.ceil(Math.sqrt(n));
  const hullPrev = new Uint32Array(n);
  const hullNext = new Uint32Array(n);
  const hullTri = new Uint32Array(n);
  const hullHash = new Int32Array(hashSize).fill(-1);
  const ids = new Uint32Array(n);
  const dists = new Float64Array(n);
  let cx = 0, cy = 0;
  let trianglesLen = 0;
  let hullStart = 0;

  function hashKey(x: number, y: number): number {
    return Math.floor(pseudoAngle(x - cx, y - cy) * hashSize) % hashSize;
  }

  function link(a: number, b: number): void {
    _halfedges[a] = b;
    if (b !== -1) _halfedges[b] = a;
  }

  function addTriangle(i0: number, i1: number, i2: number, a: number, b: number, c: number): number {
    const t = trianglesLen;
    _triangles[t] = i0; _triangles[t + 1] = i1; _triangles[t + 2] = i2;
    link(t, a); link(t + 1, b); link(t + 2, c);
    trianglesLen += 3;
    return t;
  }

  function legalize(a: number): number {
    let i = 0, ar = 0;
    while (true) {
      const b = _halfedges[a];
      const a0 = a - (a % 3);
      ar = a0 + (a + 2) % 3;
      if (b === -1) {
        if (i === 0) break;
        a = EDGE_STACK[--i];
        continue;
      }
      const b0 = b - (b % 3);
      const al = a0 + (a + 1) % 3;
      const bl = b0 + (b + 2) % 3;
      const p0 = _triangles[ar], pr = _triangles[a], pl = _triangles[al], p1 = _triangles[bl];
      const illegal = inCircle(
        coords[2 * p0], coords[2 * p0 + 1],
        coords[2 * pr], coords[2 * pr + 1],
        coords[2 * pl], coords[2 * pl + 1],
        coords[2 * p1], coords[2 * p1 + 1],
      );
      if (illegal) {
        _triangles[a] = p1; _triangles[b] = p0;
        const hbl = _halfedges[bl];
        if (hbl === -1) {
          let e = hullStart;
          do {
            if (hullTri[e] === bl) { hullTri[e] = a; break; }
            e = hullPrev[e];
          } while (e !== hullStart);
        }
        link(a, hbl); link(b, _halfedges[ar]); link(ar, bl);
        const br = b0 + (b + 1) % 3;
        if (i < EDGE_STACK.length) EDGE_STACK[i++] = br;
      } else {
        if (i === 0) break;
        a = EDGE_STACK[--i];
      }
    }
    return ar;
  }

  // Handle degenerate case
  if (n < 3) {
    for (let i = 0; i < n; i++) ids[i] = i;
    const hull = new Uint32Array(n < 2 ? n : 2);
    for (let i = 0; i < hull.length; i++) hull[i] = i;
    const inedges = new Int32Array(n).fill(-1);
    return { coords, triangles: new Uint32Array(0), halfedges: new Int32Array(0), hull, inedges };
  }

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = coords[2 * i], y = coords[2 * i + 1];
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    ids[i] = i;
  }
  cx = (minX + maxX) / 2; cy = (minY + maxY) / 2;

  // Seed triangle
  let i0 = 0, i1 = 0, i2 = 0;
  for (let i = 0, minDist = Infinity; i < n; i++) {
    const d = dist2(cx, cy, coords[2 * i], coords[2 * i + 1]);
    if (d < minDist) { i0 = i; minDist = d; }
  }
  const i0x = coords[2 * i0], i0y = coords[2 * i0 + 1];
  for (let i = 0, minDist = Infinity; i < n; i++) {
    if (i === i0) continue;
    const d = dist2(i0x, i0y, coords[2 * i], coords[2 * i + 1]);
    if (d < minDist && d > 0) { i1 = i; minDist = d; }
  }
  let i1x = coords[2 * i1], i1y = coords[2 * i1 + 1];
  let minRadius = Infinity;
  for (let i = 0; i < n; i++) {
    if (i === i0 || i === i1) continue;
    const r = circumradius(i0x, i0y, i1x, i1y, coords[2 * i], coords[2 * i + 1]);
    if (r < minRadius) { i2 = i; minRadius = r; }
  }

  // Collinear fallback
  if (minRadius === Infinity) {
    for (let i = 0; i < n; i++) {
      dists[i] = (coords[2 * i] - coords[0]) || (coords[2 * i + 1] - coords[1]);
    }
    quicksort(ids, dists, 0, n - 1);
    const hull = new Uint32Array(n);
    let j = 0;
    for (let i = 0, d0 = -Infinity; i < n; i++) {
      const id = ids[i], d = dists[id];
      if (d > d0) { hull[j++] = id; d0 = d; }
    }
    const inedges = new Int32Array(n).fill(-1);
    return {
      coords,
      triangles: new Uint32Array(0),
      halfedges: new Int32Array(0),
      hull: hull.subarray(0, j),
      inedges,
    };
  }

  // Orient CCW
  if (orient2d(i0x, i0y, i1x, i1y, coords[2 * i2], coords[2 * i2 + 1]) < 0) {
    const tmp = i1; i1 = i2; i2 = tmp;
    i1x = coords[2 * i1]; i1y = coords[2 * i1 + 1];
  }
  let i2x = coords[2 * i2], i2y = coords[2 * i2 + 1];

  const center = circumcenter(i0x, i0y, i1x, i1y, i2x, i2y);
  cx = center[0]; cy = center[1];
  for (let i = 0; i < n; i++) {
    dists[i] = dist2(coords[2 * i], coords[2 * i + 1], cx, cy);
  }
  quicksort(ids, dists, 0, n - 1);

  hullStart = i0;
  let hullSize = 3;
  hullNext[i0] = hullPrev[i2] = i1;
  hullNext[i1] = hullPrev[i0] = i2;
  hullNext[i2] = hullPrev[i1] = i0;
  hullTri[i0] = 0; hullTri[i1] = 1; hullTri[i2] = 2;
  hullHash.fill(-1);
  hullHash[hashKey(i0x, i0y)] = i0;
  hullHash[hashKey(i1x, i1y)] = i1;
  hullHash[hashKey(i2x, i2y)] = i2;
  addTriangle(i0, i1, i2, -1, -1, -1);

  for (let k = 0, xp = 0, yp = 0; k < ids.length; k++) {
    const i = ids[k];
    const x = coords[2 * i], y = coords[2 * i + 1];
    if (k > 0 && Math.abs(x - xp) <= EPSILON && Math.abs(y - yp) <= EPSILON) continue;
    xp = x; yp = y;
    if (i === i0 || i === i1 || i === i2) continue;

    let start = 0;
    for (let j = 0, key = hashKey(x, y); j < hashSize; j++) {
      start = hullHash[(key + j) % hashSize];
      if (start !== -1 && start !== hullNext[start]) break;
    }
    start = hullPrev[start];
    let e = start;
    let q = hullNext[e];
    while (orient2d(x, y, coords[2 * e], coords[2 * e + 1], coords[2 * q], coords[2 * q + 1]) >= 0) {
      e = q;
      if (e === start) { e = -1; break; }
      q = hullNext[e];
    }
    if (e === -1) continue;

    let t = addTriangle(e, i, hullNext[e], -1, -1, hullTri[e]);
    hullTri[i] = legalize(t + 2);
    hullTri[e] = t;
    hullSize++;

    let nn = hullNext[e];
    q = hullNext[nn];
    while (orient2d(x, y, coords[2 * nn], coords[2 * nn + 1], coords[2 * q], coords[2 * q + 1]) < 0) {
      t = addTriangle(nn, i, q, hullTri[i], -1, hullTri[nn]);
      hullTri[i] = legalize(t + 2);
      hullNext[nn] = nn;
      hullSize--;
      nn = q;
      q = hullNext[nn];
    }

    if (e === start) {
      q = hullPrev[e];
      while (orient2d(x, y, coords[2 * q], coords[2 * q + 1], coords[2 * e], coords[2 * e + 1]) < 0) {
        t = addTriangle(q, i, e, -1, hullTri[e], hullTri[q]);
        legalize(t + 2);
        hullTri[q] = t;
        hullNext[e] = e;
        hullSize--;
        e = q;
        q = hullPrev[e];
      }
    }

    hullStart = hullPrev[i] = e;
    hullNext[e] = hullPrev[nn] = i;
    hullNext[i] = nn;
    hullHash[hashKey(x, y)] = i;
    hullHash[hashKey(coords[2 * e], coords[2 * e + 1])] = e;
  }

  const hull = new Uint32Array(hullSize);
  for (let i = 0, e = hullStart; i < hullSize; i++) {
    hull[i] = e; e = hullNext[e];
  }

  const triangles = _triangles.subarray(0, trianglesLen);
  const halfedges = _halfedges.subarray(0, trianglesLen) as Int32Array;

  // Compute inedges (d3-delaunay/_init logic)
  const inedges = new Int32Array(n).fill(-1);
  for (let e = 0; e < halfedges.length; e++) {
    const p = triangles[e % 3 === 2 ? e - 2 : e + 1];
    if (halfedges[e] === -1 || inedges[p] === -1) inedges[p] = e;
  }

  return { coords, triangles, halfedges, hull, inedges };
}

// ──── Voronoi ─────────────────────────────────────────────────────────────────

function buildCircumcenters(
  coords: Float64Array,
  triangles: Uint32Array,
  hull: Uint32Array,
): Float64Array {
  const numTri = triangles.length / 3;
  const cc = new Float64Array(numTri * 2);
  let bx = 0, by = 0, baryComputed = false;

  for (let i = 0, j = 0; i < triangles.length; i += 3, j += 2) {
    const t1 = triangles[i] * 2, t2 = triangles[i + 1] * 2, t3 = triangles[i + 2] * 2;
    const x1 = coords[t1], y1 = coords[t1 + 1];
    const x2 = coords[t2], y2 = coords[t2 + 1];
    const x3 = coords[t3], y3 = coords[t3 + 1];
    const dx = x2 - x1, dy = y2 - y1, ex = x3 - x1, ey = y3 - y1;
    const ab = (dx * ey - dy * ex) * 2;

    if (Math.abs(ab) < 1e-9) {
      if (!baryComputed) {
        baryComputed = true;
        for (const hi of hull) { bx += coords[hi * 2]; by += coords[hi * 2 + 1]; }
        bx /= hull.length; by /= hull.length;
      }
      const a = 1e9 * Math.sign((bx - x1) * ey - (by - y1) * ex);
      cc[j] = (x1 + x3) / 2 - a * ey;
      cc[j + 1] = (y1 + y3) / 2 + a * ex;
    } else {
      const d = 1 / ab;
      const bl = dx * dx + dy * dy, cl = ex * ex + ey * ey;
      cc[j] = x1 + (ey * bl - dy * cl) * d;
      cc[j + 1] = y1 + (dx * cl - ex * bl) * d;
    }
  }
  return cc;
}

// Build exterior cell ray vectors (from voronoi.js _init)
function buildVectors(
  coords: Float64Array,
  hull: Uint32Array,
  n: number,
): Float64Array {
  const vectors = new Float64Array(n * 4);
  let h = hull[hull.length - 1];
  let p1 = h * 4, x1 = coords[2 * h], y1 = coords[2 * h + 1];
  for (let i = 0; i < hull.length; i++) {
    h = hull[i];
    const p0 = p1, x0 = x1, y0 = y1;
    p1 = h * 4; x1 = coords[2 * h]; y1 = coords[2 * h + 1];
    vectors[p0 + 2] = vectors[p1] = y0 - y1;
    vectors[p0 + 3] = vectors[p1 + 1] = x1 - x0;
  }
  return vectors;
}

// Cohen-Sutherland helpers
function regioncode(x: number, y: number, x0: number, y0: number, x1: number, y1: number): number {
  return (x < x0 ? 1 : x > x1 ? 2 : 0) | (y < y0 ? 4 : y > y1 ? 8 : 0);
}

function edgecode(x: number, y: number, x0: number, y0: number, x1: number, y1: number): number {
  return (x === x0 ? 1 : x === x1 ? 2 : 0) | (y === y0 ? 4 : y === y1 ? 8 : 0);
}

function projectRay(
  px: number, py: number, vx: number, vy: number,
  x0: number, y0: number, x1: number, y1: number,
): readonly [number, number] | null {
  let t = Infinity, rx = 0, ry = 0;
  if (vy < 0) { if (py <= y0) return null; const c = (y0 - py) / vy; if (c < t) { t = c; ry = y0; rx = px + t * vx; } }
  else if (vy > 0) { if (py >= y1) return null; const c = (y1 - py) / vy; if (c < t) { t = c; ry = y1; rx = px + t * vx; } }
  if (vx > 0) { if (px >= x1) return null; const c = (x1 - px) / vx; if (c < t) { rx = x1; ry = py + c * vy; } }
  else if (vx < 0) { if (px <= x0) return null; const c = (x0 - px) / vx; if (c < t) { rx = x0; ry = py + c * vy; } }
  return [rx, ry];
}

function clipSegment(
  sx0: number, sy0: number, sx1: number, sy1: number, c0: number, c1: number,
  x0: number, y0: number, x1: number, y1: number,
): readonly [number, number, number, number] | null {
  const flip = c0 < c1;
  if (flip) { [sx0, sy0, sx1, sy1, c0, c1] = [sx1, sy1, sx0, sy0, c1, c0]; }
  while (true) {
    if (c0 === 0 && c1 === 0) return flip ? [sx1, sy1, sx0, sy0] : [sx0, sy0, sx1, sy1];
    if (c0 & c1) return null;
    const c = c0 || c1;
    let x = 0, y = 0;
    if (c & 8) { x = sx0 + (sx1 - sx0) * (y1 - sy0) / (sy1 - sy0); y = y1; }
    else if (c & 4) { x = sx0 + (sx1 - sx0) * (y0 - sy0) / (sy1 - sy0); y = y0; }
    else if (c & 2) { y = sy0 + (sy1 - sy0) * (x1 - sx0) / (sx1 - sx0); x = x1; }
    else { y = sy0 + (sy1 - sy0) * (x0 - sx0) / (sx1 - sx0); x = x0; }
    if (c0) { sx0 = x; sy0 = y; c0 = regioncode(sx0, sy0, x0, y0, x1, y1); }
    else { sx1 = x; sy1 = y; c1 = regioncode(sx1, sy1, x0, y0, x1, y1); }
  }
}

function edgeInsert(
  i: number,
  e0: number, e1: number,
  P: number[],
  j: number,
  x0: number, y0: number, x1: number, y1: number,
  containsFn: (i: number, x: number, y: number) => boolean,
): number {
  while (e0 !== e1) {
    let x = 0, y = 0;
    switch (e0) {
      case 0b0101: e0 = 0b0100; continue;
      case 0b0100: e0 = 0b0110; x = x1; y = y0; break;
      case 0b0110: e0 = 0b0010; continue;
      case 0b0010: e0 = 0b1010; x = x1; y = y1; break;
      case 0b1010: e0 = 0b1000; continue;
      case 0b1000: e0 = 0b1001; x = x0; y = y1; break;
      case 0b1001: e0 = 0b0001; continue;
      case 0b0001: e0 = 0b0101; x = x0; y = y0; break;
      default: break;
    }
    if ((P[j] !== x || P[j + 1] !== y) && containsFn(i, x, y)) {
      P.splice(j, 0, x, y); j += 2;
    }
  }
  return j;
}

// Walk the halfedge ring to get raw circumcenter sequence for cell i
function cellPoints(
  i: number,
  inedges: Int32Array,
  halfedges: Int32Array,
  triangles: Uint32Array,
  cc: Float64Array,
): number[] | null {
  const e0 = inedges[i];
  if (e0 === -1) return null;
  const pts: number[] = [];
  let e = e0;
  do {
    const t = Math.floor(e / 3);
    pts.push(cc[t * 2], cc[t * 2 + 1]);
    e = e % 3 === 2 ? e - 2 : e + 1;
    if (triangles[e] !== i) break;
    e = halfedges[e];
  } while (e !== e0 && e !== -1);
  return pts;
}

// Clip a finite cell polygon to bounds
function clipFinite(
  i: number, pts: number[],
  x0: number, y0: number, x1: number, y1: number,
  containsFn: (i: number, x: number, y: number) => boolean,
): number[] | null {
  const n = pts.length;
  let P: number[] | null = null;
  let cx1 = pts[n - 2], cy1 = pts[n - 1];
  let c1 = regioncode(cx1, cy1, x0, y0, x1, y1);
  let e0 = 0, e1 = 0;
  for (let j = 0; j < n; j += 2) {
    const cx0 = cx1, cy0 = cy1;
    cx1 = pts[j]; cy1 = pts[j + 1];
    const c0 = c1;
    c1 = regioncode(cx1, cy1, x0, y0, x1, y1);
    if (c0 === 0 && c1 === 0) {
      e0 = e1; e1 = 0;
      if (P) P.push(cx1, cy1); else P = [cx1, cy1];
    } else {
      let seg, sx0 = 0, sy0 = 0, sx1 = 0, sy1 = 0;
      if (c0 === 0) {
        seg = clipSegment(cx0, cy0, cx1, cy1, c0, c1, x0, y0, x1, y1);
        if (!seg) continue;
        [sx0, sy0, sx1, sy1] = seg;
      } else {
        seg = clipSegment(cx1, cy1, cx0, cy0, c1, c0, x0, y0, x1, y1);
        if (!seg) continue;
        [sx1, sy1, sx0, sy0] = seg;
        e0 = e1; e1 = edgecode(sx0, sy0, x0, y0, x1, y1);
        if (e0 && e1 && P) edgeInsert(i, e0, e1, P, P.length, x0, y0, x1, y1, containsFn);
        if (P) P.push(sx0, sy0); else P = [sx0, sy0];
      }
      e0 = e1; e1 = edgecode(sx1, sy1, x0, y0, x1, y1);
      if (e0 && e1 && P) edgeInsert(i, e0, e1, P, P.length, x0, y0, x1, y1, containsFn);
      if (P) P.push(sx1, sy1); else P = [sx1, sy1];
    }
  }
  if (P) {
    e0 = e1; e1 = edgecode(P[0], P[1], x0, y0, x1, y1);
    if (e0 && e1) edgeInsert(i, e0, e1, P, P.length, x0, y0, x1, y1, containsFn);
  } else if (containsFn(i, (x0 + x1) / 2, (y0 + y1) / 2)) {
    return [x1, y0, x1, y1, x0, y1, x0, y0];
  }
  return P;
}

function clipInfinite(
  i: number, pts: number[],
  vx0: number, vy0: number, vxn: number, vyn: number,
  x0: number, y0: number, x1: number, y1: number,
  containsFn: (i: number, x: number, y: number) => boolean,
): number[] | null {
  let P = Array.from(pts);
  const p0 = projectRay(P[0], P[1], vx0, vy0, x0, y0, x1, y1);
  if (p0) P.unshift(p0[0], p0[1]);
  const pn = projectRay(P[P.length - 2], P[P.length - 1], vxn, vyn, x0, y0, x1, y1);
  if (pn) P.push(pn[0], pn[1]);
  P = clipFinite(i, P, x0, y0, x1, y1, containsFn) ?? [];
  if (P.length > 0) {
    for (let j = 0, pLen = P.length, c0 = 0, c1 = edgecode(P[pLen - 2], P[pLen - 1], x0, y0, x1, y1); j < pLen; j += 2) {
      c0 = c1; c1 = edgecode(P[j], P[j + 1], x0, y0, x1, y1);
      if (c0 && c1) { j = edgeInsert(i, c0, c1, P, j, x0, y0, x1, y1, containsFn); pLen = P.length; }
    }
  } else if (containsFn(i, (x0 + x1) / 2, (y0 + y1) / 2)) {
    return [x0, y0, x1, y0, x1, y1, x0, y1];
  }
  return P.length > 0 ? P : null;
}

// ──── Public Voronoi API ──────────────────────────────────────────────────────

// Returns cell polygons as flat coordinate arrays [x0,y0, x1,y1, ...] or null
function computeVoronoiCellsRaw(
  result: DelaunayResult,
  bounds: Bounds,
): ReadonlyArray<number[] | null> {
  const { coords, triangles, halfedges, hull, inedges } = result;
  const [bx0, by0, bx1, by1] = bounds;
  const n = coords.length / 2;
  const cc = buildCircumcenters(coords, triangles, hull);
  const vectors = buildVectors(coords, hull, n);

  // Nearest-point lookup for containsFn (simplified step walk)
  function step(i: number, x: number, y: number): number {
    if (inedges[i] === -1 || !coords.length) return (i + 1) % n;
    let c = i, dc = (x - coords[i * 2]) ** 2 + (y - coords[i * 2 + 1]) ** 2;
    const e0 = inedges[i];
    let e = e0;
    do {
      const t = triangles[e];
      const dt = (x - coords[t * 2]) ** 2 + (y - coords[t * 2 + 1]) ** 2;
      if (dt < dc) { dc = dt; c = t; }
      e = e % 3 === 2 ? e - 2 : e + 1;
      if (triangles[e] !== i) break;
      e = halfedges[e];
      if (e === -1) break;
    } while (e !== e0);
    return c;
  }

  function contains(i: number, x: number, y: number): boolean {
    if ((x !== x) || (y !== y)) return false;
    return step(i, x, y) === i;
  }

  const cells: Array<number[] | null> = [];
  for (let i = 0; i < n; i++) {
    if (hull.length === 1 && i === 0) {
      cells.push([bx1, by0, bx1, by1, bx0, by1, bx0, by0]);
      continue;
    }
    const pts = cellPoints(i, inedges, halfedges, triangles, cc);
    if (!pts) { cells.push(null); continue; }
    const v = i * 4;
    const clipped =
      vectors[v] || vectors[v + 1]
        ? clipInfinite(i, pts, vectors[v], vectors[v + 1], vectors[v + 2], vectors[v + 3],
            bx0, by0, bx1, by1, contains)
        : clipFinite(i, pts, bx0, by0, bx1, by1, contains);
    cells.push(clipped);
  }
  return cells;
}

// Convert flat cell coordinates to array of [x, y] pairs
export function voronoiCells(
  result: DelaunayResult,
  bounds: Bounds,
): ReadonlyArray<ReadonlyArray<Point2D> | null> {
  const raw = computeVoronoiCellsRaw(result, bounds);
  return raw.map((cell) => {
    if (!cell) return null;
    const pts: Point2D[] = [];
    for (let i = 0; i < cell.length; i += 2) pts.push([cell[i], cell[i + 1]]);
    return pts;
  });
}

// Generate SVG path string for all Voronoi cell borders
export function voronoiPath(
  result: DelaunayResult,
  bounds: Bounds,
): string {
  const raw = computeVoronoiCellsRaw(result, bounds);
  const parts: string[] = [];
  for (const cell of raw) {
    if (!cell || cell.length < 4) continue;
    let d = `M${cell[0].toFixed(1)},${cell[1].toFixed(1)}`;
    for (let i = 2; i < cell.length; i += 2) {
      d += `L${cell[i].toFixed(1)},${cell[i + 1].toFixed(1)}`;
    }
    d += 'Z';
    parts.push(d);
  }
  return parts.join('');
}

// Convenience: triangulate + voronoiCells in one call
export function voronoiDiagram(
  points: ReadonlyArray<Point2D>,
  bounds: Bounds,
): ReadonlyArray<ReadonlyArray<Point2D> | null> {
  return voronoiCells(triangulate(points), bounds);
}
