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
