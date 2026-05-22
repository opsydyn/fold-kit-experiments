// D3 parity: d3-hierarchy/src/hierarchy/index.js + treemap/index.js + treemap/squarify.js
// Functional API — no prototype methods. Call hierarchy(), sum(), sort(), then treemap().

// ── Types ────────────────────────────────────────────────────────────────────

export interface HierarchyNode<Datum> {
  data: Datum;
  depth: number;
  height: number;
  parent: HierarchyNode<Datum> | null;
  children?: Array<HierarchyNode<Datum>>;
  value: number;
  // Assigned by treemap():
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// ── Internal traversals ───────────────────────────────────────────────────────

function eachBefore<D>(root: HierarchyNode<D>, fn: (n: HierarchyNode<D>) => void): void {
  const stack: Array<HierarchyNode<D>> = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) break;
    fn(node);
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; --i) {
        const c = node.children[i];
        if (c !== undefined) stack.push(c);
      }
    }
  }
}

function eachAfter<D>(root: HierarchyNode<D>, fn: (n: HierarchyNode<D>) => void): void {
  const stack: Array<HierarchyNode<D>> = [root];
  const next: Array<HierarchyNode<D>> = [];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) break;
    next.push(node);
    if (node.children) {
      for (const child of node.children) stack.push(child);
    }
  }
  while (next.length > 0) {
    const node = next.pop();
    if (node) fn(node);
  }
}

// ── Public: hierarchy ────────────────────────────────────────────────────────

// D3 parity: d3-hierarchy/src/hierarchy/index.js
export function hierarchy<Datum>(
  data: Datum,
  getChildren: (d: Datum) => Datum[] | null | undefined = (d) =>
    (d as { children?: Datum[] }).children,
): HierarchyNode<Datum> {
  const root: HierarchyNode<Datum> = {
    data,
    depth: 0,
    height: 0,
    parent: null,
    value: 0,
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
  };

  const stack: Array<HierarchyNode<Datum>> = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) break;
    const childData = getChildren(node.data);
    if (childData && childData.length > 0) {
      node.children = childData.map((d) => ({
        data: d,
        depth: node.depth + 1,
        height: 0,
        parent: node,
        value: 0,
        x0: 0,
        y0: 0,
        x1: 0,
        y1: 0,
      }));
      for (let i = node.children.length - 1; i >= 0; --i) {
        const c = node.children[i];
        if (c !== undefined) stack.push(c);
      }
    }
  }

  // Compute height (greatest distance to any descendant leaf)
  eachAfter(root, (node) => {
    const children = node.children;
    if (!children || children.length === 0) {
      node.height = 0;
    } else {
      let max = 0;
      for (const child of children) if (child.height > max) max = child.height;
      node.height = max + 1;
    }
  });

  return root;
}

// ── Public: sum, sort, leaves, descendants ───────────────────────────────────

// D3 parity: d3-hierarchy/src/hierarchy/sum.js
export function sum<Datum>(
  root: HierarchyNode<Datum>,
  valueFn: (d: Datum) => number,
): HierarchyNode<Datum> {
  eachAfter(root, (node) => {
    let s = Math.max(0, valueFn(node.data));
    if (node.children) for (const child of node.children) s += child.value;
    node.value = s;
  });
  return root;
}

// D3 parity: d3-hierarchy/src/hierarchy/sort.js
export function sort<Datum>(
  root: HierarchyNode<Datum>,
  compare: (a: HierarchyNode<Datum>, b: HierarchyNode<Datum>) => number,
): HierarchyNode<Datum> {
  eachBefore(root, (node) => {
    if (node.children) node.children.sort(compare);
  });
  return root;
}

// D3 parity: d3-hierarchy/src/hierarchy/leaves.js
export function leaves<Datum>(root: HierarchyNode<Datum>): Array<HierarchyNode<Datum>> {
  const result: Array<HierarchyNode<Datum>> = [];
  eachBefore(root, (node) => {
    if (!node.children) result.push(node);
  });
  return result;
}

// D3 parity: d3-hierarchy/src/hierarchy/descendants.js
export function descendants<Datum>(root: HierarchyNode<Datum>): Array<HierarchyNode<Datum>> {
  const result: Array<HierarchyNode<Datum>> = [];
  eachBefore(root, (node) => result.push(node));
  return result;
}

// ── Public: partition ─────────────────────────────────────────────────────────

// D3 parity: d3-hierarchy/src/partition.js
// x0/x1 = angular/horizontal span; y0/y1 = radial/vertical span.
// For sunburst: width = 2π, height = outerRadius.
export interface PartitionConfig {
  readonly width: number;
  readonly height: number;
  readonly padding?: number;
  readonly round?: boolean;
}

export function partition<Datum>(
  root: HierarchyNode<Datum>,
  config: PartitionConfig,
): HierarchyNode<Datum> {
  const { width: dx, height: dy, padding = 0, round = false } = config;
  const n = root.height + 1;

  root.x0 = padding;
  root.y0 = padding;
  root.x1 = dx;
  root.y1 = dy / n;

  eachBefore(root, (node) => {
    if (node.children) {
      dice(
        { value: node.value, children: node.children },
        node.x0,
        (dy * (node.depth + 1)) / n,
        node.x1,
        (dy * (node.depth + 2)) / n,
      );
    }
    let x0 = node.x0;
    let y0 = node.y0;
    let x1 = node.x1 - padding;
    let y1 = node.y1 - padding;
    if (x1 < x0) x0 = x1 = (x0 + x1) / 2;
    if (y1 < y0) y0 = y1 = (y0 + y1) / 2;
    node.x0 = x0;
    node.y0 = y0;
    node.x1 = x1;
    node.y1 = y1;
  });

  if (round) {
    eachBefore(root, (node) => {
      node.x0 = Math.round(node.x0);
      node.y0 = Math.round(node.y0);
      node.x1 = Math.round(node.x1);
      node.y1 = Math.round(node.y1);
    });
  }

  return root;
}

// ── Treemap tiling ────────────────────────────────────────────────────────────

// D3 parity: d3-hierarchy/src/treemap/dice.js
function dice<D>(
  row: { value: number; children: Array<HierarchyNode<D>> },
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  const k = row.value !== 0 ? (x1 - x0) / row.value : 0;
  let cx = x0;
  for (const node of row.children) {
    node.y0 = y0;
    node.y1 = y1;
    node.x0 = cx;
    cx += node.value * k;
    node.x1 = cx;
  }
}

// D3 parity: d3-hierarchy/src/treemap/slice.js
function slice<D>(
  row: { value: number; children: Array<HierarchyNode<D>> },
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  const k = row.value !== 0 ? (y1 - y0) / row.value : 0;
  let cy = y0;
  for (const node of row.children) {
    node.x0 = x0;
    node.x1 = x1;
    node.y0 = cy;
    cy += node.value * k;
    node.y1 = cy;
  }
}

// D3 parity: d3-hierarchy/src/treemap/squarify.js
// phi = golden ratio; rows are built to minimise worst aspect ratio
const phi = (1 + Math.sqrt(5)) / 2;

function squarifyRatio<D>(
  ratio: number,
  parent: HierarchyNode<D>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  const nodes = parent.children;
  if (!nodes) return;
  const n = nodes.length;
  let i0 = 0;
  let i1 = 0;
  let value = parent.value;

  while (i0 < n) {
    const dx = x1 - x0;
    const dy = y1 - y0;

    // Advance past leading zero-value nodes
    let sumValue = 0;
    while (i1 < n) {
      const v = nodes[i1++]?.value ?? 0;
      sumValue = v;
      if (sumValue !== 0) break;
    }
    if (sumValue === 0) break;

    let minValue = sumValue;
    let maxValue = sumValue;
    const alpha = Math.max(dy / dx, dx / dy) / (value * ratio);
    let beta = sumValue * sumValue * alpha;
    let minRatio = Math.max(maxValue / beta, beta / minValue);

    // Keep adding nodes while the worst aspect ratio improves
    for (; i1 < n; ++i1) {
      const nodeValue = nodes[i1]?.value ?? 0;
      sumValue += nodeValue;
      if (nodeValue < minValue) minValue = nodeValue;
      if (nodeValue > maxValue) maxValue = nodeValue;
      beta = sumValue * sumValue * alpha;
      const newRatio = Math.max(maxValue / beta, beta / minValue);
      if (newRatio > minRatio) {
        sumValue -= nodeValue;
        break;
      }
      minRatio = newRatio;
    }

    const row = { value: sumValue, children: nodes.slice(i0, i1) };
    if (dx < dy) {
      // Portrait rectangle: tile row along x, advance y downward
      const nextY0 = value ? y0 + (dy * sumValue) / value : y1;
      dice(row, x0, y0, x1, nextY0);
      y0 = nextY0;
    } else {
      // Landscape rectangle: tile row along y, advance x rightward
      const nextX0 = value ? x0 + (dx * sumValue) / value : x1;
      slice(row, x0, y0, nextX0, y1);
      x0 = nextX0;
    }

    value -= sumValue;
    i0 = i1;
  }
}

// ── Public: treemap ───────────────────────────────────────────────────────────

export interface TreemapConfig {
  readonly width: number;
  readonly height: number;
  /** Gap between sibling nodes */
  readonly paddingInner?: number;
  /** Uniform outer padding (shorthand; per-side values override) */
  readonly paddingOuter?: number;
  readonly paddingTop?: number;
  readonly paddingRight?: number;
  readonly paddingBottom?: number;
  readonly paddingLeft?: number;
  /** Snap coordinates to integer pixels */
  readonly round?: boolean;
}

// D3 parity: d3-hierarchy/src/treemap/index.js (squarify tiling, constant padding)
export function treemap<Datum>(
  root: HierarchyNode<Datum>,
  config: TreemapConfig,
): HierarchyNode<Datum> {
  const {
    width,
    height,
    paddingInner = 0,
    paddingOuter = 0,
    paddingTop = paddingOuter,
    paddingRight = paddingOuter,
    paddingBottom = paddingOuter,
    paddingLeft = paddingOuter,
    round = false,
  } = config;

  root.x0 = 0;
  root.y0 = 0;
  root.x1 = width;
  root.y1 = height;

  // paddingStack[depth] = paddingInner/2 set by the parent at that depth
  const paddingStack: number[] = [0];

  eachBefore(root, (node) => {
    const p = paddingStack[node.depth] ?? 0;
    let x0 = node.x0 + p;
    let y0 = node.y0 + p;
    let x1 = node.x1 - p;
    let y1 = node.y1 - p;
    if (x1 < x0) x0 = x1 = (x0 + x1) / 2;
    if (y1 < y0) y0 = y1 = (y0 + y1) / 2;
    node.x0 = x0;
    node.y0 = y0;
    node.x1 = x1;
    node.y1 = y1;

    if (node.children) {
      const pi = paddingInner / 2;
      paddingStack[node.depth + 1] = pi;
      let cx0 = x0 + paddingLeft - pi;
      let cy0 = y0 + paddingTop - pi;
      let cx1 = x1 - paddingRight + pi;
      let cy1 = y1 - paddingBottom + pi;
      if (cx1 < cx0) cx0 = cx1 = (cx0 + cx1) / 2;
      if (cy1 < cy0) cy0 = cy1 = (cy0 + cy1) / 2;
      squarifyRatio(phi, node, cx0, cy0, cx1, cy1);
    }
  });

  if (round) {
    eachBefore(root, (node) => {
      node.x0 = Math.round(node.x0);
      node.y0 = Math.round(node.y0);
      node.x1 = Math.round(node.x1);
      node.y1 = Math.round(node.y1);
    });
  }

  return root;
}

// ── Pack layout ───────────────────────────────────────────────────────────────

// D3 parity: d3-hierarchy/src/pack/index.js + enclose.js + siblings.js

export interface PackConfig {
  readonly width: number;
  readonly height: number;
  readonly padding?: number;
}

export interface PackNode<Datum> {
  data: Datum;
  depth: number;
  height: number;
  parent: PackNode<Datum> | null;
  children?: Array<PackNode<Datum>>;
  value: number;
  x: number;
  y: number;
  r: number;
}

interface MCircle {
  x: number;
  y: number;
  r: number;
}

interface PackChainNode {
  c: MCircle;
  next: PackChainNode;
  prev: PackChainNode;
}

function enclosesWeak(a: MCircle, b: MCircle): boolean {
  const dr = a.r - b.r + Math.max(a.r, b.r, 1) * 1e-9;
  if (dr <= 0) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dr * dr > dx * dx + dy * dy;
}

function enclosesNot(a: MCircle, b: MCircle): boolean {
  const dr = a.r - b.r;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dr < 0 || dr * dr < dx * dx + dy * dy;
}

// Fixed-size Welzl basis (at most 3 support circles) — avoids array allocation per step
interface Basis {
  b0: MCircle;
  b1: MCircle;
  b2: MCircle;
  n: number;
}

function makeBasis(): Basis {
  const z: MCircle = { x: 0, y: 0, r: 0 };
  return { b0: z, b1: z, b2: z, n: 0 };
}

function basisGet(b: Basis, i: number): MCircle {
  return i === 0 ? b.b0 : i === 1 ? b.b1 : b.b2;
}

function basisContainsAll(enc: MCircle, b: Basis): boolean {
  if (b.n >= 1 && !enclosesWeak(enc, b.b0)) return false;
  if (b.n >= 2 && !enclosesWeak(enc, b.b1)) return false;
  if (b.n >= 3 && !enclosesWeak(enc, b.b2)) return false;
  return true;
}

function basisEnclose(b: Basis): MCircle {
  if (b.n === 0) return { x: 0, y: 0, r: 0 };
  if (b.n === 1) return { x: b.b0.x, y: b.b0.y, r: b.b0.r };
  if (b.n === 2) return eb2(b.b0, b.b1);
  return eb3(b.b0, b.b1, b.b2);
}

function eb2(a: MCircle, b: MCircle): MCircle {
  const x21 = b.x - a.x;
  const y21 = b.y - a.y;
  const r21 = b.r - a.r;
  const l = Math.sqrt(x21 * x21 + y21 * y21);
  return {
    x: (a.x + b.x + (x21 / l) * r21) / 2,
    y: (a.y + b.y + (y21 / l) * r21) / 2,
    r: (l + a.r + b.r) / 2,
  };
}

function eb3(a: MCircle, b: MCircle, c: MCircle): MCircle {
  const x1 = a.x,
    y1 = a.y,
    r1 = a.r;
  const x2 = b.x,
    y2 = b.y,
    r2 = b.r;
  const x3 = c.x,
    y3 = c.y,
    r3 = c.r;
  const a2 = x1 - x2,
    a3 = x1 - x3;
  const b2 = y1 - y2,
    b3 = y1 - y3;
  const c2 = r2 - r1,
    c3 = r3 - r1;
  const d1 = x1 * x1 + y1 * y1 - r1 * r1;
  const d2 = d1 - x2 * x2 - y2 * y2 + r2 * r2;
  const d3 = d1 - x3 * x3 - y3 * y3 + r3 * r3;
  const ab = a3 * b2 - a2 * b3;
  const xa = (b2 * d3 - b3 * d2) / (ab * 2) - x1;
  const xb = (b3 * c2 - b2 * c3) / ab;
  const ya = (a3 * d2 - a2 * d3) / (ab * 2) - y1;
  const yb = (a2 * c3 - a3 * c2) / ab;
  const A = xb * xb + yb * yb - 1;
  const B2 = 2 * (r1 + xa * xb + ya * yb);
  const C = xa * xa + ya * ya - r1 * r1;
  const rr = -(Math.abs(A) > 1e-6 ? (B2 + Math.sqrt(B2 * B2 - 4 * A * C)) / (2 * A) : C / B2);
  return { x: x1 + xa + xb * rr, y: y1 + ya + yb * rr, r: rr };
}

// D3 parity: d3-hierarchy/src/pack/enclose.js extendBasis
// Mutates b so p lies on the boundary of the new MEC.
// Basis has ≤3 slots → all loops are O(1), no heap allocation.
// Bug fix vs prior implementation: checks full basis b (not a slice) in enclosesWeakAll.
function extendBasis(b: Basis, p: MCircle): void {
  const n = b.n;

  if (basisContainsAll(p, b)) {
    b.b0 = p;
    b.n = 1;
    return;
  }

  for (let i = 0; i < n; i++) {
    const bi = basisGet(b, i);
    if (enclosesNot(p, bi) && basisContainsAll(eb2(bi, p), b)) {
      b.b0 = bi;
      b.b1 = p;
      b.n = 2;
      return;
    }
  }

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const bi = basisGet(b, i);
      const bj = basisGet(b, j);
      if (
        enclosesNot(eb2(bi, bj), p) &&
        enclosesNot(eb2(bi, p), bj) &&
        enclosesNot(eb2(bj, p), bi) &&
        basisContainsAll(eb3(bi, bj, p), b)
      ) {
        b.b0 = bi;
        b.b1 = bj;
        b.b2 = p;
        b.n = 3;
        return;
      }
    }
  }
}

function packEnclose(circles: MCircle[]): MCircle {
  const n = circles.length;
  if (n === 0) return { x: 0, y: 0, r: 0 };

  // Fisher-Yates shuffle for expected O(n) Welzl termination (D3 parity)
  const cs = circles.slice();
  for (let s = n - 1; s > 0; s--) {
    const t = (Math.random() * (s + 1)) | 0;
    const a = cs[s] as MCircle;
    cs[s] = cs[t] as MCircle;
    cs[t] = a;
  }

  const b = makeBasis();
  let e: MCircle = { x: 0, y: 0, r: 0 };
  let i = 0;

  while (i < n) {
    const p = cs[i] as MCircle;
    if (b.n > 0 && enclosesWeak(e, p)) {
      i++;
    } else {
      extendBasis(b, p);
      e = basisEnclose(b);
      i = 0;
    }
  }

  return e;
}

function packPlace(a: MCircle, b: MCircle, c: MCircle): void {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  if (d2 === 0) {
    c.x = a.x + a.r + c.r;
    c.y = a.y;
    return;
  }
  const dac = a.r + c.r,
    dbc = b.r + c.r;
  const cos = Math.max(-1, Math.min(1, (d2 + dac * dac - dbc * dbc) / (2 * dac * Math.sqrt(d2))));
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  const d = Math.sqrt(d2);
  c.x = a.x + dac * (cos * (dx / d) - sin * (dy / d));
  c.y = a.y + dac * (cos * (dy / d) + sin * (dx / d));
}

function chainIntersects(a: MCircle, b: MCircle): boolean {
  const dx = a.x - b.x,
    dy = a.y - b.y;
  const dr = a.r + b.r - 1e-6;
  return dr > 0 && dr * dr > dx * dx + dy * dy;
}

function chainScore(node: PackChainNode): number {
  const a = node.c,
    b = node.next.c;
  const ab = a.r + b.r;
  const dx = (a.x * b.r + b.x * a.r) / ab;
  const dy = (a.y * b.r + b.y * a.r) / ab;
  return dx * dx + dy * dy;
}

function makeChainNode(c: MCircle): PackChainNode {
  const node = { c } as PackChainNode;
  node.next = node;
  node.prev = node;
  return node;
}

function packSiblings(circles: MCircle[]): void {
  const n = circles.length;
  if (n === 0) return;
  const c0 = circles[0];
  if (!c0) return;
  c0.x = 0;
  c0.y = 0;
  if (n === 1) return;
  const c1 = circles[1];
  if (!c1) return;
  c0.x = -c1.r;
  c1.x = c0.r;
  c1.y = 0;
  if (n === 2) return;
  const c2 = circles[2];
  if (!c2) return;
  packPlace(c0, c1, c2);

  let aa = makeChainNode(c0);
  let bb = makeChainNode(c1);
  const cc = makeChainNode(c2);
  aa.next = cc.prev = bb;
  bb.next = aa.prev = cc;
  cc.next = bb.prev = aa;

  outer: for (let i = 3; i < n; i++) {
    const ci = circles[i];
    if (!ci) continue;
    packPlace(aa.c, bb.c, ci);

    let j = bb.next;
    let k = aa.prev;
    let sj = bb.c.r;
    let sk = aa.c.r;

    do {
      if (sj <= sk) {
        if (chainIntersects(j.c, ci)) {
          bb = j;
          aa.next = bb;
          bb.prev = aa;
          i--;
          continue outer;
        }
        sj += j.next.c.r;
        j = j.next;
      } else {
        if (chainIntersects(k.c, ci)) {
          aa = k;
          aa.next = bb;
          bb.prev = aa;
          i--;
          continue outer;
        }
        sk += k.prev.c.r;
        k = k.prev;
      }
    } while (j !== k.next);

    const newNode = makeChainNode(ci);
    newNode.prev = aa;
    newNode.next = bb;
    aa.next = bb.prev = bb = newNode;

    let minScore = chainScore(aa);
    let cur = aa.next;
    while (cur !== bb) {
      const s = chainScore(cur);
      if (s < minScore) {
        aa = cur;
        minScore = s;
      }
      cur = cur.next;
    }
    bb = aa.next;
  }
}

// D3 parity: d3-hierarchy/src/pack/index.js
export function pack<Datum>(root: HierarchyNode<Datum>, config: PackConfig): PackNode<Datum> {
  const { width, height, padding = 0 } = config;
  type N = HierarchyNode<Datum> & MCircle;

  eachAfter(root, (node) => {
    const n = node as N;
    if (!node.children || node.children.length === 0) {
      n.x = 0;
      n.y = 0;
      n.r = Math.sqrt(node.value);
    } else {
      const children = node.children.map((c) => c as N);
      packSiblings(children);
      const enc = packEnclose(children);
      n.r = enc.r + padding;
      for (const c of children) {
        c.x -= enc.x;
        c.y -= enc.y;
      }
    }
  });

  const rootN = root as N;
  const k = Math.min(width, height) / 2 / rootN.r;
  rootN.x = width / 2;
  rootN.y = height / 2;
  rootN.r *= k;

  eachBefore(root, (node) => {
    if (node.parent) {
      const n = node as N;
      const p = node.parent as N;
      n.x = p.x + n.x * k;
      n.y = p.y + n.y * k;
      n.r *= k;
    }
  });

  return root as unknown as PackNode<Datum>;
}

// ── Public: treeLayout ────────────────────────────────────────────────────────

// D3 parity: d3-hierarchy/src/tree.js — Reingold-Tilford "tidy" algorithm
// (Buchheim et al. O(n) improvement).
// Returns a flat array of TreeLayoutNode with x (0..width) and y (0..height).

export type TreeLayoutNode<Datum> = Readonly<{
  data: Datum;
  depth: number;
  height: number;
  parent: TreeLayoutNode<Datum> | null;
  children?: ReadonlyArray<TreeLayoutNode<Datum>>;
  value: number;
  x: number;
  y: number;
}>;

export type TreeConfig = Readonly<{
  width?: number;
  height?: number;
  nodeSize?: readonly [number, number] | null;
  separation?: (a: HierarchyNode<unknown>, b: HierarchyNode<unknown>) => number;
}>;

// Internal wrapper node for the algorithm
interface TN {
  _: HierarchyNode<unknown>;
  parent: TN;
  children: TN[] | null;
  A: TN | null;
  a: TN;
  z: number;
  m: number;
  c: number;
  s: number;
  t: TN | null;
  i: number;
}

function defaultSep(a: HierarchyNode<unknown>, b: HierarchyNode<unknown>): number {
  return a.parent === b.parent ? 1 : 2;
}

function tnNextLeft(v: TN): TN | null {
  return v.children ? v.children[0] ?? null : v.t;
}

function tnNextRight(v: TN): TN | null {
  return v.children ? v.children[v.children.length - 1] ?? null : v.t;
}

function tnMoveSubtree(wm: TN, wp: TN, shift: number): void {
  const change = shift / (wp.i - wm.i);
  wp.c -= change;
  wp.s += shift;
  wm.c += change;
  wp.z += shift;
  wp.m += shift;
}

function tnExecuteShifts(v: TN): void {
  let shift = 0;
  let change = 0;
  const children = v.children;
  if (!children) return;
  for (let i = children.length - 1; i >= 0; --i) {
    const w = children[i];
    if (!w) continue;
    w.z += shift;
    w.m += shift;
    change += w.c;
    shift += w.s + change;
  }
}

function tnNextAncestor(vim: TN, v: TN, ancestor: TN): TN {
  return vim.a.parent === v.parent ? vim.a : ancestor;
}

function makeTN(node: HierarchyNode<unknown>, i: number, parent: TN): TN {
  const tn: TN = {
    _: node, parent, children: null,
    A: null, a: null as unknown as TN,
    z: 0, m: 0, c: 0, s: 0, t: null, i,
  };
  tn.a = tn;
  return tn;
}

function buildTNTree(root: HierarchyNode<unknown>): TN {
  const sentinel = makeTN(root, 0, null as unknown as TN);
  const tree = makeTN(root, 0, sentinel);
  sentinel.children = [tree];

  const stack: TN[] = [tree];
  while (stack.length > 0) {
    const v = stack.pop();
    if (!v) continue;
    const kids = v._.children;
    if (kids && kids.length > 0) {
      v.children = new Array(kids.length);
      for (let i = kids.length - 1; i >= 0; --i) {
        const child = makeTN(kids[i] as HierarchyNode<unknown>, i, v);
        (v.children as TN[])[i] = child;
        stack.push(child);
      }
    }
  }
  return tree;
}

export function treeLayout<Datum>(
  root: HierarchyNode<Datum>,
  config: TreeConfig = {},
): ReadonlyArray<TreeLayoutNode<Datum>> {
  const {
    width = 1,
    height = 1,
    nodeSize = null,
    separation = defaultSep as (a: HierarchyNode<unknown>, b: HierarchyNode<unknown>) => number,
  } = config;

  const t = buildTNTree(root as unknown as HierarchyNode<unknown>);

  // First walk (bottom-up): assign prelim x coords
  function firstWalk(v: TN): void {
    const children = v.children;
    const siblings = v.parent.children;
    const w: TN | null = v.i > 0 ? (siblings?.[v.i - 1] ?? null) : null;
    if (children && children.length > 0) {
      tnExecuteShifts(v);
      const midpoint = ((children[0]?.z ?? 0) + (children[children.length - 1]?.z ?? 0)) / 2;
      if (w) {
        v.z = w.z + separation(v._, w._);
        v.m = v.z - midpoint;
      } else {
        v.z = midpoint;
      }
    } else if (w) {
      v.z = w.z + separation(v._, w._);
    }
    v.parent.A = apportion(v, w, v.parent.A ?? (siblings?.[0] ?? v));
  }

  function apportion(v: TN, w: TN | null, ancestor: TN): TN {
    if (!w) return ancestor;
    let vip: TN = v, vop: TN = v;
    let vim: TN = w;
    let vom: TN = (vip.parent.children?.[0]) ?? vip;
    let sip = vip.m, sop = vop.m, sim = vim.m, som = vom.m;

    let nr = tnNextRight(vim), nl = tnNextLeft(vip);
    while (nr && nl) {
      vim = nr; vip = nl;
      vom = tnNextLeft(vom) ?? vom;
      vop = tnNextRight(vop) ?? vop;
      vop.a = v;
      const shift = vim.z + sim - vip.z - sip + separation(vim._, vip._);
      if (shift > 0) {
        tnMoveSubtree(tnNextAncestor(vim, v, ancestor), v, shift);
        sip += shift;
        sop += shift;
      }
      sim += vim.m; sip += vip.m; som += vom.m; sop += vop.m;
      nr = tnNextRight(vim); nl = tnNextLeft(vip);
    }
    if (nr && !tnNextRight(vop)) {
      vop.t = nr;
      vop.m += sim - sop;
    }
    if (nl && !tnNextLeft(vom)) {
      vom.t = nl;
      vom.m += sip - som;
      ancestor = v;
    }
    return ancestor;
  }

  // Second walk (top-down): accumulate mods into final x
  function secondWalk(v: TN): void {
    v._.x0 = v.z + v.parent.m;
    v.m += v.parent.m;
  }

  // Run both passes
  eachAfter(t as unknown as HierarchyNode<Datum>, (n) => firstWalk(n as unknown as TN));
  (t.parent as TN).m = -t.z;
  eachBefore(t as unknown as HierarchyNode<Datum>, (n) => secondWalk(n as unknown as TN));

  // x0 now holds unnormalized x; depth holds y index
  if (nodeSize) {
    const [dx, dy] = nodeSize;
    eachBefore(root, (node) => {
      node.x0 = node.x0 * dx;
      node.y0 = node.depth * dy;
    });
  } else {
    // Find extents and normalize to [0, width] x [0, height]
    let left = root, right = root, bottom = root;
    eachBefore(root, (node) => {
      if (node.x0 < left.x0) left = node;
      if (node.x0 > right.x0) right = node;
      if (node.depth > bottom.depth) bottom = node;
    });
    const s = left === right ? 1 : separation(left as unknown as HierarchyNode<unknown>, right as unknown as HierarchyNode<unknown>) / 2;
    const tx = s - left.x0;
    const kx = width / (right.x0 + s + tx);
    const ky = height / (bottom.depth || 1);
    eachBefore(root, (node) => {
      node.x0 = (node.x0 + tx) * kx;
      node.y0 = node.depth * ky;
    });
  }

  // Collect flat array of TreeLayoutNode
  const result: TreeLayoutNode<Datum>[] = [];
  eachBefore(root, (node) => {
    (result as unknown as Array<{ data: Datum; depth: number; height: number; parent: unknown; children?: unknown[]; value: number; x: number; y: number }>)
      .push({
        data: node.data,
        depth: node.depth,
        height: node.height,
        parent: null,
        value: node.value,
        x: node.x0,
        y: node.y0,
      });
  });

  // Wire up parent/children references
  const nodeMap = new Map<HierarchyNode<Datum>, TreeLayoutNode<Datum>>();
  eachBefore(root, (node) => {
    const idx = result.findIndex((r) => r.data === node.data && r.depth === node.depth);
    if (idx >= 0) nodeMap.set(node, result[idx] as TreeLayoutNode<Datum>);
  });

  eachBefore(root, (node) => {
    const tln = nodeMap.get(node);
    if (!tln) return;
    const mut = tln as { parent: TreeLayoutNode<Datum> | null; children?: TreeLayoutNode<Datum>[] };
    if (node.parent) mut.parent = nodeMap.get(node.parent as HierarchyNode<Datum>) ?? null;
    if (node.children) {
      mut.children = node.children
        .map((c) => nodeMap.get(c as HierarchyNode<Datum>))
        .filter((c): c is TreeLayoutNode<Datum> => c !== undefined);
    }
  });

  return result;
}

// ── Public: clusterLayout ─────────────────────────────────────────────────────

// D3 parity: d3-hierarchy/src/cluster.js
// All leaves at the same radius; internal nodes at mean-x of their children.
// Returns a flat array of ClusterLayoutNode with:
//   x = angle in [0, width]   (default: 2π for full circle)
//   y = radius in [0, height] (0 = root at center, height = leaves at edge)

export type ClusterLayoutNode<Datum> = Readonly<{
  data: Datum;
  depth: number;
  height: number;
  parent: ClusterLayoutNode<Datum> | null;
  children?: ReadonlyArray<ClusterLayoutNode<Datum>>;
  value: number;
  x: number;
  y: number;
}>;

export type ClusterConfig = Readonly<{
  width?: number;
  height?: number;
  separation?: (a: HierarchyNode<unknown>, b: HierarchyNode<unknown>) => number;
}>;

function clusterDefaultSep(a: HierarchyNode<unknown>, b: HierarchyNode<unknown>): number {
  return a.parent === b.parent ? 1 : 2;
}

function clusterLeafLeft<D>(node: HierarchyNode<D>): HierarchyNode<D> {
  let n = node;
  while (n.children && n.children.length > 0) n = n.children[0] as HierarchyNode<D>;
  return n;
}

function clusterLeafRight<D>(node: HierarchyNode<D>): HierarchyNode<D> {
  let n = node;
  while (n.children && n.children.length > 0) n = n.children[n.children.length - 1] as HierarchyNode<D>;
  return n;
}

export function clusterLayout<Datum>(
  root: HierarchyNode<Datum>,
  config: ClusterConfig = {},
): ReadonlyArray<ClusterLayoutNode<Datum>> {
  const {
    width = 2 * Math.PI,
    height = 1,
    separation = clusterDefaultSep as (a: HierarchyNode<unknown>, b: HierarchyNode<unknown>) => number,
  } = config;

  let previousLeaf: HierarchyNode<Datum> | null = null;
  let leafX = 0;

  eachAfter(root, (node) => {
    const kids = node.children;
    if (!kids || kids.length === 0) {
      if (previousLeaf) {
        leafX += separation(node as unknown as HierarchyNode<unknown>, previousLeaf as unknown as HierarchyNode<unknown>);
      }
      node.x0 = leafX;
      node.y0 = 0;
      previousLeaf = node;
    } else {
      let sumX = 0;
      let maxY = 0;
      for (const child of kids) {
        sumX += child.x0;
        if (child.y0 > maxY) maxY = child.y0;
      }
      node.x0 = sumX / kids.length;
      node.y0 = maxY + 1;
    }
  });

  const ll = clusterLeafLeft(root);
  const lr = clusterLeafRight(root);
  const x0 = ll.x0 - separation(ll as unknown as HierarchyNode<unknown>, lr as unknown as HierarchyNode<unknown>) / 2;
  const x1 = lr.x0 + separation(lr as unknown as HierarchyNode<unknown>, ll as unknown as HierarchyNode<unknown>) / 2;
  const rootY = root.y0;

  eachAfter(root, (node) => {
    node.x0 = (node.x0 - x0) / (x1 - x0) * width;
    node.y0 = rootY > 0 ? (1 - node.y0 / rootY) * height : height;
  });

  const result: ClusterLayoutNode<Datum>[] = [];
  const nodeMap = new Map<HierarchyNode<Datum>, ClusterLayoutNode<Datum>>();

  eachBefore(root, (node) => {
    const cln: ClusterLayoutNode<Datum> = {
      data: node.data,
      depth: node.depth,
      height: node.height,
      parent: null,
      value: node.value,
      x: node.x0,
      y: node.y0,
    };
    result.push(cln);
    nodeMap.set(node, cln);
  });

  eachBefore(root, (node) => {
    const cln = nodeMap.get(node);
    if (!cln) return;
    const mut = cln as { parent: ClusterLayoutNode<Datum> | null; children?: ClusterLayoutNode<Datum>[] };
    if (node.parent) mut.parent = nodeMap.get(node.parent as HierarchyNode<Datum>) ?? null;
    if (node.children) {
      mut.children = node.children
        .map((c) => nodeMap.get(c as HierarchyNode<Datum>))
        .filter((c): c is ClusterLayoutNode<Datum> => c !== undefined);
    }
  });

  return result;
}
