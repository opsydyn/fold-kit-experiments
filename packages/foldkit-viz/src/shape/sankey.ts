// Sankey layout + link path — D3 d3-sankey parity
import { path } from './path';

// INPUT TYPES

export type SankeyInputNode = Readonly<{ id: string }>;
export type SankeyInputLink = Readonly<{ source: string; target: string; value: number }>;

export type SankeyConfig = Readonly<{
  width: number;
  height: number;
  nodeWidth?: number;
  nodePadding?: number;
  iterations?: number;
}>;

// OUTPUT TYPES

export type SankeyNode = Readonly<{
  id: string;
  column: number;
  maxColumn: number;
  value: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}>;

export type SankeyLink = Readonly<{
  sourceId: string;
  targetId: string;
  value: number;
  width: number;
  y0: number;
  y1: number;
  pathD: string;
}>;

export type SankeyLayout = Readonly<{
  nodes: ReadonlyArray<SankeyNode>;
  links: ReadonlyArray<SankeyLink>;
}>;

// INTERNAL MUTABLE TYPES

interface MNode {
  id: string;
  depth: number;
  column: number;
  value: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sLinks: MLink[];
  tLinks: MLink[];
}

interface MLink {
  source: MNode;
  target: MNode;
  value: number;
  width: number;
  y0: number;
  y1: number;
}

// SANKEY LAYOUT

export function sankey(
  inputNodes: ReadonlyArray<SankeyInputNode>,
  inputLinks: ReadonlyArray<SankeyInputLink>,
  config: SankeyConfig,
): SankeyLayout {
  const { width, height, nodeWidth = 16, nodePadding = 10, iterations = 6 } = config;

  // Build mutable node map
  const nodeMap = new Map<string, MNode>();
  for (const n of inputNodes) {
    nodeMap.set(n.id, {
      id: n.id,
      depth: 0,
      column: 0,
      value: 0,
      x0: 0,
      y0: 0,
      x1: nodeWidth,
      y1: 0,
      sLinks: [],
      tLinks: [],
    });
  }

  // Build links
  const mLinks: MLink[] = [];
  for (const l of inputLinks) {
    const src = nodeMap.get(l.source);
    const tgt = nodeMap.get(l.target);
    if (!src || !tgt || l.value <= 0) continue;
    const ml: MLink = { source: src, target: tgt, value: l.value, width: 0, y0: 0, y1: 0 };
    src.sLinks.push(ml);
    tgt.tLinks.push(ml);
    mLinks.push(ml);
  }

  const mNodes = [...nodeMap.values()];

  // Assign depths: start with all nodes (D3 approach) — each node gets depth of
  // last BFS wave that reaches it, giving the LONGEST-PATH depth from any source.
  {
    const n = mNodes.length;
    let current = new Set(mNodes);
    for (let d = 0; current.size > 0 && d <= n; ++d) {
      const next = new Set<MNode>();
      for (const nd of current) {
        nd.depth = d;
        for (const l of nd.sLinks) next.add(l.target);
      }
      current = next;
    }
  }

  const maxDepth = mNodes.reduce((m, n) => Math.max(m, n.depth), 0);

  // Justify: sinks (no outgoing) go to the last column
  for (const n of mNodes) {
    n.column = n.sLinks.length === 0 ? maxDepth : n.depth;
  }

  // X positions
  const kx = maxDepth > 0 ? (width - nodeWidth) / maxDepth : 0;
  for (const n of mNodes) {
    n.x0 = Math.round(n.column * kx * 10) / 10;
    n.x1 = n.x0 + nodeWidth;
  }

  // Node values: max(sum incoming, sum outgoing), minimum 1 to avoid degenerate nodes
  for (const n of mNodes) {
    const inV = n.tLinks.reduce((s, l) => s + l.value, 0);
    const outV = n.sLinks.reduce((s, l) => s + l.value, 0);
    n.value = Math.max(inV, outV, 1);
  }

  // Scale factor ky: minimum across all columns so no column overflows height
  const columnMap = new Map<number, MNode[]>();
  for (const n of mNodes) {
    const arr = columnMap.get(n.column) ?? [];
    arr.push(n);
    columnMap.set(n.column, arr);
  }

  let ky = Number.POSITIVE_INFINITY;
  for (const [, col] of columnMap) {
    const totalV = col.reduce((s, n) => s + n.value, 0);
    const avail = height - (col.length - 1) * nodePadding;
    if (totalV > 0) ky = Math.min(ky, avail / totalV);
  }
  if (!Number.isFinite(ky) || ky <= 0) ky = 1;

  // Link widths
  for (const l of mLinks) l.width = l.value * ky;

  // Initial placement: stack nodes top-to-bottom, largest first
  for (const [, col] of columnMap) {
    col.sort((a, b) => b.value - a.value);
    let y = 0;
    for (const n of col) {
      n.y0 = y;
      n.y1 = y + n.value * ky;
      y = n.y1 + nodePadding;
    }
  }

  // Iterative relaxation
  const colOrder = [...columnMap.keys()].sort((a, b) => a - b);
  for (let iter = 0; iter < iterations; ++iter) {
    const alpha = (1 - (iter + 1) / (iterations + 1)) * 0.99;

    // Right-to-left: pull each node toward its targets' centres
    for (const col of [...colOrder].reverse()) {
      const nodes = columnMap.get(col) ?? [];
      for (const n of nodes) {
        if (n.sLinks.length === 0) continue;
        const totalV = n.sLinks.reduce((s, l) => s + l.value, 0);
        if (totalV === 0) continue;
        const wY =
          n.sLinks.reduce((s, l) => s + ((l.target.y0 + l.target.y1) / 2) * l.value, 0) / totalV;
        const dy = (wY - (n.y0 + n.y1) / 2) * alpha;
        n.y0 += dy;
        n.y1 += dy;
      }
    }
    resolveCollisions(columnMap, nodePadding, height);

    // Left-to-right: pull each node toward its sources' centres
    for (const col of colOrder) {
      const nodes = columnMap.get(col) ?? [];
      for (const n of nodes) {
        if (n.tLinks.length === 0) continue;
        const totalV = n.tLinks.reduce((s, l) => s + l.value, 0);
        if (totalV === 0) continue;
        const wY =
          n.tLinks.reduce((s, l) => s + ((l.source.y0 + l.source.y1) / 2) * l.value, 0) / totalV;
        const dy = (wY - (n.y0 + n.y1) / 2) * alpha;
        n.y0 += dy;
        n.y1 += dy;
      }
    }
    resolveCollisions(columnMap, nodePadding, height);
  }

  // Link y-offsets: stack links within each node, sorted toward target/source centres
  for (const n of mNodes) {
    n.sLinks.sort((a, b) => (a.target.y0 + a.target.y1) / 2 - (b.target.y0 + b.target.y1) / 2);
    n.tLinks.sort((a, b) => (a.source.y0 + a.source.y1) / 2 - (b.source.y0 + b.source.y1) / 2);
    let y0 = n.y0;
    for (const l of n.sLinks) {
      l.y0 = y0 + l.width / 2;
      y0 += l.width;
    }
    let y1 = n.y0;
    for (const l of n.tLinks) {
      l.y1 = y1 + l.width / 2;
      y1 += l.width;
    }
  }

  // Build readonly output
  const r1 = (n: number) => Math.round(n * 10) / 10;

  const outputNodes: SankeyNode[] = mNodes.map((n) => ({
    id: n.id,
    column: n.column,
    maxColumn: maxDepth,
    value: n.value,
    x0: r1(n.x0),
    y0: r1(n.y0),
    x1: r1(n.x1),
    y1: r1(n.y1),
  }));

  const outputLinks: SankeyLink[] = mLinks.map((l) => ({
    sourceId: l.source.id,
    targetId: l.target.id,
    value: l.value,
    width: r1(l.width),
    y0: r1(l.y0),
    y1: r1(l.y1),
    pathD: makeLinkPath(l.source.x1, l.y0, l.target.x0, l.y1, l.width),
  }));

  return { nodes: outputNodes, links: outputLinks };
}

function resolveCollisions(columnMap: Map<number, MNode[]>, padding: number, height: number): void {
  for (const [, nodes] of columnMap) {
    nodes.sort((a, b) => a.y0 - b.y0);

    // Push down: ensure no overlap from top
    let y = 0;
    for (const n of nodes) {
      if (n.y0 < y) {
        const delta = y - n.y0;
        n.y0 = y;
        n.y1 += delta;
      }
      y = n.y1 + padding;
    }

    // Push up: ensure nothing exceeds viewport bottom
    y = height;
    for (let i = nodes.length - 1; i >= 0; --i) {
      const n = nodes[i];
      if (!n) continue;
      if (n.y1 > y) {
        const delta = n.y1 - y;
        n.y0 -= delta;
        n.y1 = y;
      }
      y = n.y0 - padding;
    }
  }
}

// LINK PATH: filled bezier ribbon connecting source right-edge to target left-edge

function makeLinkPath(sx1: number, sy: number, tx0: number, ty: number, w: number): string {
  const p = path(2);
  const mx = (sx1 + tx0) / 2;
  const half = w / 2;
  p.moveTo(sx1, sy - half);
  p.bezierCurveTo(mx, sy - half, mx, ty - half, tx0, ty - half);
  p.lineTo(tx0, ty + half);
  p.bezierCurveTo(mx, ty + half, mx, sy + half, sx1, sy + half);
  p.closePath();
  return p.toString();
}
