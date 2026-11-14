import {
  clusterLayout,
  descendants,
  hierarchy,
  pack,
  sum,
  treeLayout,
} from '../hierarchy/index.js';
import type { HierarchyNode } from '../hierarchy/index.js';
import { voronoiDiagram } from '../math/delaunay.js';
import { arc } from '../shape/arc.js';
import { chord, ribbon } from '../shape/chord.js';
import { linkHorizontal, linkRadial } from '../shape/link.js';
import { runForceLayout } from '../simulation/index.js';
import { fail, keysOf, numeric, paintOf, read, spanOf, titlesOf, withTitle } from './channels.js';
import type { Context, Graphics } from './channels.js';
import { firstRow, treeOf } from './marks-panel.js';
import type { Tree } from './marks-panel.js';
import type {
  ArcDiagramMark,
  ChordMark,
  ForceMark,
  Graphic,
  PackMark,
  Row,
  TreeMark,
  Value,
  VoronoiMark,
} from './types.js';

/**
 * Networks and trees that fill their panel. Each runs its layout at compile
 * time, so the output is static geometry: trees, circle packing, chords, arc
 * diagrams and force-directed graphs.
 */

const DEG = Math.PI / 180;
const round = (n: number): number => Math.round(n * 100) / 100;
const LABEL_SIZE = 11;

/** A label's rough width, for leaving room beside a tree. */
const textWidth = (text: string): number => text.length * 6.2;

/** The paint for a node: its first row's fill, as treemap and sunburst do. */
function nodeFill(
  node: HierarchyNode<Tree>,
  fill: TreeMark['fill'],
  path: string,
  context: Context,
): string {
  const row = firstRow(node);
  return row === undefined
    ? 'currentColor'
    : (paintOf([row], fill, `${path}.fill`, context, 'currentColor')[0] ?? 'currentColor');
}

/**
 * The real root: a single top-level node rather than the empty root above it,
 * rebuilt so its depth starts at zero, as layouts expect.
 */
function rootOf(tree: HierarchyNode<Tree>): HierarchyNode<Tree> {
  const only = tree.children?.length === 1 ? tree.children[0] : undefined;
  if (only === undefined) return tree;
  return sum(
    hierarchy(only.data, (d) => (d.children.length === 0 ? undefined : d.children)),
    (d) => (d.children.length === 0 ? d.value : 0),
  );
}

// ── Trees ─────────────────────────────────────────────────────────────────────

export function treeGraphics(
  mark: TreeMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics {
  const { bounds } = context;
  const root = rootOf(treeOf(mark, rows, path, true));
  const all = descendants(root);
  const labels = mark.labels ?? true;
  const linkColour =
    paintOf([{}], mark.stroke, `${path}.stroke`, context, 'currentColor')[0] ?? 'currentColor';
  const graphics: Graphic[] = [];
  const node = (id: string, x: number, y: number, n: HierarchyNode<Tree>, title: string) =>
    graphics.push({
      kind: 'circle',
      key: id,
      cx: round(x),
      cy: round(y),
      r: 3.5,
      fill: n.children === undefined ? nodeFill(n, mark.fill, path, context) : 'currentColor',
      stroke: 'none',
      strokeWidth: 0,
      opacity: 1,
      title,
    });
  if (mark.radial === true) {
    // Only leaves are labelled round a radial tree; branches name themselves on hover.
    const longest =
      spanOf(all.filter((n) => n.children === undefined).map((n) => textWidth(n.data.name)))?.[1] ??
      0;
    const radius = Math.max(
      10,
      Math.min(bounds.width, bounds.height) / 2 - (labels ? longest + 8 : 8),
    );
    const laid = clusterOrTree(mark, root, 2 * Math.PI, radius, path);
    const cx = bounds.left + bounds.width / 2,
      cy = bounds.top + bounds.height / 2;
    const at = (angle: number, r: number) =>
      [cx + r * Math.sin(angle), cy - r * Math.cos(angle)] as const;
    for (const n of laid)
      if (n.parent !== null)
        graphics.push({
          kind: 'path',
          key: `${n.data.id}:link`,
          d: linkRadial({ angle: n.parent.x, radius: n.parent.y }, { angle: n.x, radius: n.y }),
          translate: [round(cx), round(cy)],
          fill: 'none',
          stroke: linkColour,
          strokeWidth: 1,
          opacity: 0.4,
        });
    for (const n of laid) {
      const [x, y] = at(n.x, n.y);
      node(n.data.id, x, y, n.source, n.data.id);
      if (!labels || n.source.children !== undefined) continue;
      const right = Math.sin(n.x) >= 0;
      const [lx, ly] = at(n.x, n.y + 6);
      graphics.push({
        kind: 'text',
        key: `${n.data.id}:label`,
        x: round(lx),
        y: round(ly + 4),
        text: n.data.name,
        fill: 'currentColor',
        anchor: right ? 'start' : 'end',
        opacity: 0.9,
      });
    }
    return graphics;
  }
  // Left to right: depth runs across, leaving room for the leaves' labels.
  const widest =
    spanOf(all.filter((n) => n.children === undefined).map((n) => textWidth(n.data.name)))?.[1] ??
    0;
  const rootLabel = textWidth(root.data.name);
  const left = bounds.left + (labels ? rootLabel + 8 : 6);
  const across = Math.max(10, bounds.right - (labels ? widest + 10 : 6) - left);
  const laid = clusterOrTree(mark, root, bounds.height - 12, across, path);
  const at = (n: Laid) => [left + n.y, bounds.top + 6 + n.x] as const;
  for (const n of laid)
    if (n.parent !== null) {
      const [px, py] = at(n.parent),
        [x, y] = at(n);
      graphics.push({
        kind: 'path',
        key: `${n.data.id}:link`,
        d: linkHorizontal({ x: px, y: py }, { x, y }),
        fill: 'none',
        stroke: linkColour,
        strokeWidth: 1,
        opacity: 0.4,
      });
    }
  for (const n of laid) {
    const [x, y] = at(n);
    node(n.data.id, x, y, n.source, n.data.id);
    if (!labels) continue;
    const leaf = n.source.children === undefined;
    graphics.push({
      kind: 'text',
      key: `${n.data.id}:label`,
      x: round(x + (leaf ? 7 : -7)),
      y: round(y + 4),
      text: n.data.name,
      fill: 'currentColor',
      anchor: leaf ? 'start' : 'end',
      opacity: 0.9,
    });
  }
  return graphics;
}

/** A laid-out node: x across the breadth, y along the depth, and its hierarchy node. */
type Laid = Readonly<{
  data: Tree;
  depth: number;
  x: number;
  y: number;
  parent: Laid | null;
  source: HierarchyNode<Tree>;
}>;

function clusterOrTree(
  mark: TreeMark,
  root: HierarchyNode<Tree>,
  breadth: number,
  depth: number,
  path: string,
): ReadonlyArray<Laid> {
  const layout: unknown = mark.layout ?? 'tidy';
  if (layout !== 'tidy' && layout !== 'cluster')
    fail(`${path}.layout`, `unknown layout "${String(layout)}"; expected tidy or cluster`);
  const nodes =
    layout === 'cluster'
      ? clusterLayout(root, { width: breadth, height: depth })
      : treeLayout(root, { width: breadth, height: depth });
  const sources = descendants(root);
  const byData = new Map(sources.map((n) => [n.data, n]));
  const laid = new Map<Tree, Laid>();
  // Layouts list parents before their children, so a parent is always laid first.
  for (const n of nodes) {
    const parent = n.parent === null ? null : (laid.get(n.parent.data) ?? null);
    const source = byData.get(n.data);
    if (source === undefined) continue;
    laid.set(n.data, { data: n.data, depth: n.depth, x: n.x, y: n.y, parent, source });
  }
  return [...laid.values()];
}

// ── Circle packing ────────────────────────────────────────────────────────────

export function packGraphics(
  mark: PackMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics {
  const { bounds } = context;
  const size = Math.min(bounds.width, bounds.height);
  const packed = pack(treeOf(mark, rows, path), {
    width: size,
    height: size,
    padding: mark.padding ?? 3,
  });
  const ox = bounds.left + (bounds.width - size) / 2,
    oy = bounds.top + (bounds.height - size) / 2;
  const hierarchyNodes = descendants(treeOf(mark, rows, path));
  const byId = new Map(hierarchyNodes.map((n) => [n.data.id, n]));
  const graphics: Graphic[] = [];
  const walk = (n: typeof packed): void => {
    const source = byId.get(n.data.id);
    if (n.depth > 0 && source !== undefined) {
      const leaf = n.children === undefined || n.children.length === 0;
      graphics.push({
        kind: 'circle',
        key: n.data.id,
        cx: round(ox + n.x),
        cy: round(oy + n.y),
        r: round(n.r),
        fill: nodeFill(source, mark.fill, path, context),
        stroke: 'none',
        strokeWidth: 0,
        opacity: (mark.opacity ?? 1) * (leaf ? 0.85 : 0.2),
        title: `${n.data.id}: ${n.value}`,
      });
      if ((mark.labels ?? true) && leaf && n.r > textWidth(n.data.name) / 2 + 2)
        graphics.push({
          kind: 'text',
          key: `${n.data.id}:label`,
          x: round(ox + n.x),
          y: round(oy + n.y + 4),
          text: n.data.name,
          fill: 'white',
          anchor: 'middle',
          opacity: 0.95,
        });
    }
    for (const child of n.children ?? []) walk(child);
  };
  walk(packed);
  return graphics;
}

// ── Flows between named nodes ─────────────────────────────────────────────────

type Flows = Readonly<{
  names: ReadonlyArray<string>;
  links: ReadonlyArray<readonly [number, number, number]>;
}>;

/** Named nodes in order of first appearance, and each row as [source, target, value]. */
function flowsOf(
  rows: ReadonlyArray<Row>,
  mark: ChordMark | ArcDiagramMark | ForceMark,
  path: string,
): Flows {
  const sources = read(rows, mark.source, `${path}.source`),
    targets = read(rows, mark.target, `${path}.target`);
  const values =
    'value' in mark && mark.value !== undefined
      ? read(rows, mark.value, `${path}.value`).map(numeric)
      : rows.map(() => 1);
  const names: string[] = [];
  const indexOf = (v: Value): number => {
    const name = String(v);
    const at = names.indexOf(name);
    if (at >= 0) return at;
    names.push(name);
    return names.length - 1;
  };
  const links = rows.flatMap((_, i): ReadonlyArray<readonly [number, number, number]> => {
    const s = sources[i],
      t = targets[i],
      v = values[i] ?? Number.NaN;
    if (s === null || s === undefined || t === null || t === undefined) return [];
    return [[indexOf(s), indexOf(t), Number.isFinite(v) ? v : 0]];
  });
  return { names, links };
}

/** A node's colour, categorical by name, as sankey nodes take. */
const nameColour = (name: string, context: Context): string =>
  context.color?.paint(name) ?? 'currentColor';

export function chordGraphics(
  mark: ChordMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics {
  const { bounds } = context;
  const { names, links } = flowsOf(rows, mark, path);
  const matrix = names.map(() => names.map(() => 0));
  for (const [s, t, v] of links) {
    const row = matrix[s];
    if (row !== undefined) row[t] = (row[t] ?? 0) + v;
  }
  const labels = mark.labels ?? true;
  const outer = Math.max(10, Math.min(bounds.width, bounds.height) / 2 - (labels ? 28 : 4));
  const inner = outer - 12;
  const layout = chord(matrix, { padAngle: (mark.padAngle ?? 2) * DEG });
  const cx = round(bounds.left + bounds.width / 2),
    cy = round(bounds.top + bounds.height / 2);
  const graphics: Graphic[] = [];
  for (const c of layout.chords) {
    const name = names[c.source.index] ?? '';
    graphics.push({
      kind: 'path',
      key: `${name}->${names[c.target.index] ?? ''}`,
      d: ribbon(c.source, c.target, { radius: inner - 1 }),
      translate: [cx, cy],
      fill: nameColour(name, context),
      stroke: 'none',
      strokeWidth: 0,
      opacity: (mark.opacity ?? 1) * 0.6,
      title: `${name} and ${names[c.target.index] ?? ''}: ${round(c.source.value)}`,
    });
  }
  for (const g of layout.groups) {
    const name = names[g.index] ?? '';
    graphics.push({
      kind: 'path',
      key: name,
      d: arc({
        innerRadius: inner,
        outerRadius: outer,
        startAngle: g.startAngle,
        endAngle: g.endAngle,
      }),
      translate: [cx, cy],
      fill: nameColour(name, context),
      stroke: 'none',
      strokeWidth: 0,
      opacity: mark.opacity ?? 1,
      title: `${name}: ${round(g.value)}`,
    });
    if (!labels || g.endAngle - g.startAngle < 0.12) continue;
    const middle = (g.startAngle + g.endAngle) / 2;
    const r = outer + 8;
    const sin = Math.sin(middle);
    graphics.push({
      kind: 'text',
      key: `${name}:label`,
      x: round(cx + r * sin),
      y: round(cy - r * Math.cos(middle) + 4),
      text: name,
      fill: 'currentColor',
      anchor: sin > 0.2 ? 'start' : sin < -0.2 ? 'end' : 'middle',
      opacity: 0.9,
    });
  }
  return graphics;
}

export function arcDiagramGraphics(
  mark: ArcDiagramMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics {
  const { bounds } = context;
  const { names, links } = flowsOf(rows, mark, path);
  const labels = mark.labels ?? true;
  const baseline = bounds.bottom - (labels ? LABEL_SIZE + 10 : 6);
  const step = names.length > 1 ? (bounds.width - 24) / (names.length - 1) : 0;
  const xOf = (i: number) => bounds.left + 12 + i * step;
  const titles = titlesOf(rows, mark.title, `${path}.title`);
  const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'currentColor');
  const most = Math.max(spanOf(links.map(([, , v]) => v))?.[1] ?? 1, 1e-9);
  const graphics: Graphic[] = links.map(([s, t, v], i): Graphic => {
    const x1 = xOf(Math.min(s, t)),
      x2 = xOf(Math.max(s, t));
    const r = (x2 - x1) / 2;
    return {
      kind: 'path',
      key: `${names[s] ?? ''}->${names[t] ?? ''}`,
      d: `M${round(x1)},${round(baseline)}A${round(r)},${round(r)} 0 0,1 ${round(x2)},${round(baseline)}`,
      fill: 'none',
      stroke: strokes[i] ?? 'currentColor',
      strokeWidth: round(1 + (3 * v) / most),
      opacity: (mark.opacity ?? 1) * 0.5,
      ...withTitle(titles[i] ?? `${names[s] ?? ''} – ${names[t] ?? ''}`),
    };
  });
  const fill =
    mark.fill === undefined
      ? undefined
      : paintOf([{}], mark.fill, `${path}.fill`, context, 'currentColor')[0];
  names.forEach((name, i) => {
    graphics.push({
      kind: 'circle',
      key: name,
      cx: round(xOf(i)),
      cy: round(baseline),
      r: 4,
      fill: fill ?? 'currentColor',
      stroke: 'none',
      strokeWidth: 0,
      opacity: 1,
      title: name,
    });
    if (labels)
      graphics.push({
        kind: 'text',
        key: `${name}:label`,
        x: round(xOf(i)),
        y: round(baseline + LABEL_SIZE + 6),
        text: name,
        fill: 'currentColor',
        anchor: 'middle',
        opacity: 0.9,
      });
  });
  return graphics;
}

export function forceGraphics(
  mark: ForceMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics {
  const { bounds } = context;
  const { names, links } = flowsOf(rows, mark, path);
  const iterations = mark.iterations ?? 300;
  if (!(Number.isInteger(iterations) && iterations >= 1 && iterations <= 5000))
    fail(`${path}.iterations`, 'must be a whole number from 1 to 5000');
  const layout = runForceLayout({
    nodes: names.map((id) => ({ id })),
    links: links.map(([s, t]) => ({ source: names[s] ?? '', target: names[t] ?? '' })),
    width: bounds.width,
    height: bounds.height,
    strength: mark.strength ?? -120,
    linkDistance: mark.distance ?? 60,
    collideRadius: 20,
    iterations,
  });
  const position = new Map(layout.nodes.map((n) => [n.id, n]));
  // Keep every node inside the panel, whatever the forces did.
  const clampX = (x: number) =>
    Math.min(bounds.right - 8, Math.max(bounds.left + 8, bounds.left + x));
  const clampY = (y: number) =>
    Math.min(bounds.bottom - 8, Math.max(bounds.top + 8, bounds.top + y));
  const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'currentColor');
  const graphics: Graphic[] = layout.links.flatMap(
    (l, i): ReadonlyArray<Graphic> => [
      {
        kind: 'line',
        key: `${l.sourceId}->${l.targetId}`,
        x1: round(clampX(l.x1)),
        y1: round(clampY(l.y1)),
        x2: round(clampX(l.x2)),
        y2: round(clampY(l.y2)),
        stroke: strokes[i] ?? 'currentColor',
        strokeWidth: mark.strokeWidth ?? 1,
        opacity: 0.35,
      },
    ],
  );
  const fill =
    mark.fill === undefined
      ? undefined
      : paintOf([{}], mark.fill, `${path}.fill`, context, 'currentColor')[0];
  for (const name of names) {
    const n = position.get(name);
    if (n === undefined) continue;
    const x = round(clampX(n.x)),
      y = round(clampY(n.y));
    graphics.push({
      kind: 'circle',
      key: name,
      cx: x,
      cy: y,
      r: 6,
      fill: fill ?? 'currentColor',
      stroke: 'none',
      strokeWidth: 0,
      opacity: 1,
      ...withTitle(name),
    });
    if (mark.labels ?? true)
      graphics.push({
        kind: 'text',
        key: `${name}:label`,
        x: x,
        y: round(y - 10),
        text: name,
        fill: 'currentColor',
        anchor: 'middle',
        opacity: 0.85,
      });
  }
  return graphics;
}

// ── Voronoi ───────────────────────────────────────────────────────────────────

/** Each point's Voronoi cell on the x and y axes, clipped to the plot area. */
export function voronoiGraphics(
  mark: VoronoiMark,
  rows: ReadonlyArray<Row>,
  path: string,
  index: number,
  context: Context,
): Graphics {
  const x = context.x ?? fail(`${path}.x`, 'no scale could be resolved for this axis');
  const y = context.y ?? fail(`${path}.y`, 'no scale could be resolved for this axis');
  const xs = read(rows, mark.x, `${path}.x`),
    ys = read(rows, mark.y, `${path}.y`);
  const placed = rows.flatMap(
    (_, i): ReadonlyArray<readonly [number, readonly [number, number]]> => {
      const px = x.place(xs[i] ?? null),
        py = y.place(ys[i] ?? null);
      return px === undefined || py === undefined ? [] : [[i, [px, py]]];
    },
  );
  if (placed.length < 2) return [];
  const { bounds } = context;
  const cells = voronoiDiagram(
    placed.map(([, point]) => point),
    [bounds.left, bounds.top, bounds.right, bounds.bottom],
  );
  const keys = keysOf(rows, mark, index);
  const titles = titlesOf(rows, mark.title, `${path}.title`);
  const fills = paintOf(rows, mark.fill, `${path}.fill`, context, 'none');
  const strokes = paintOf(
    rows,
    mark.stroke,
    `${path}.stroke`,
    context,
    mark.fill === undefined ? 'currentColor' : 'white',
  );
  return placed.flatMap(([i], k): ReadonlyArray<Graphic> => {
    const cell = cells[k];
    if (cell === null || cell === undefined || cell.length < 3) return [];
    const d = `M${cell.map(([px, py]) => `${round(px)},${round(py)}`).join('L')}Z`;
    return [
      {
        kind: 'path',
        key: keys[i] ?? `${index}:${i}`,
        d,
        fill: fills[i] ?? 'none',
        stroke: strokes[i] ?? 'currentColor',
        strokeWidth: mark.strokeWidth ?? 1,
        opacity: mark.opacity ?? 1,
        ...withTitle(titles[i]),
      },
    ];
  });
}
