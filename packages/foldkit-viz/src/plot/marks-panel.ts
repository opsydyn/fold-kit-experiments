import {
  hierarchy,
  leaves,
  partition,
  sort,
  sum,
  treemap,
  descendants,
} from '../hierarchy/index.js';
import type { HierarchyNode } from '../hierarchy/index.js';
import { linearTicks } from '../math/scale.js';
import { arc, arcCentroid } from '../shape/arc.js';
import { line } from '../shape/line.js';
import { sankey } from '../shape/sankey.js';
import { fail, keysOf, numeric, paintOf, read, spanOf, titlesOf, withTitle } from './channels.js';
import type { Context, Graphics } from './channels.js';
import type {
  Channel,
  Graphic,
  ParallelMark,
  Row,
  SankeyMark,
  SunburstMark,
  TreemapMark,
} from './types.js';

/**
 * Marks that fill their panel instead of using the x and y axes: hierarchies
 * (treemap, sunburst), flows (sankey) and parallel coordinates.
 */

// ── Hierarchies from path fields ──────────────────────────────────────────────

export type Tree = {
  name: string;
  /** Full path to this node, joined with the separator. */
  id: string;
  value: number;
  row?: Row;
  children: Tree[];
};

/** What a hierarchy is built from: leaf paths, and optionally their sizes. */
export type HierarchySource = Readonly<{ path: Channel; value?: Channel; separator?: string }>;

/**
 * A hierarchy from rows whose `path` names each leaf, such as "Cloud/AWS".
 * Without a `value`, each leaf counts once. Sorted largest first unless
 * `ordered`, which keeps the rows' order, as trees read best.
 */
export function treeOf(
  mark: HierarchySource,
  rows: ReadonlyArray<Row>,
  path: string,
  ordered = false,
): HierarchyNode<Tree> {
  const separator = mark.separator ?? '/';
  const paths = read(rows, mark.path, `${path}.path`);
  const values =
    mark.value === undefined
      ? rows.map(() => 1)
      : read(rows, mark.value, `${path}.value`).map(numeric);
  const root: Tree = { name: '', id: '', value: 0, children: [] };
  rows.forEach((row, i) => {
    const raw = paths[i];
    const value = values[i] ?? Number.NaN;
    if (raw === null || raw === undefined || !Number.isFinite(value) || value <= 0) return;
    let node = root;
    const parts = String(raw)
      .split(separator)
      .filter((part) => part !== '');
    parts.forEach((part, depth) => {
      const id = parts.slice(0, depth + 1).join(separator);
      let child = node.children.find((c) => c.name === part);
      if (child === undefined) {
        child = { name: part, id, value: 0, children: [] };
        node.children.push(child);
      }
      node = child;
    });
    node.value += value;
    node.row = row;
  });
  const tree = sum(
    hierarchy(root, (d) => (d.children.length === 0 ? undefined : d.children)),
    (d) => (d.children.length === 0 ? d.value : 0),
  );
  return ordered ? tree : sort(tree, (a, b) => b.value - a.value);
}

/** The first row under a node, so a branch takes the colour of its leading leaf. */
export const firstRow = (node: HierarchyNode<Tree>): Row | undefined =>
  node.data.row ?? leaves(node).find((leaf) => leaf.data.row !== undefined)?.data.row;

function nodePaint(
  node: HierarchyNode<Tree>,
  mark: TreemapMark | SunburstMark,
  path: string,
  context: Context,
): string {
  const row = firstRow(node);
  return row === undefined
    ? 'currentColor'
    : (paintOf([row], mark.fill, `${path}.fill`, context, 'currentColor')[0] ?? 'currentColor');
}

const LABEL = 12;

export function treemapGraphics(
  mark: TreemapMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics {
  const { bounds } = context;
  const padding = mark.padding ?? 2;
  if (!(Number.isFinite(padding) && padding >= 0))
    fail(`${path}.padding`, 'must be finite and non-negative');
  const root = treemap(treeOf(mark, rows, path), {
    width: bounds.width,
    height: bounds.height,
    paddingInner: padding,
  });
  const titles = new Map(
    leaves(root).map((leaf) => [leaf.data.id, `${leaf.data.id}: ${leaf.value}`]),
  );
  return leaves(root).flatMap((leaf): ReadonlyArray<Graphic> => {
    const x = bounds.left + leaf.x0,
      y = bounds.top + leaf.y0;
    const width = leaf.x1 - leaf.x0,
      height = leaf.y1 - leaf.y0;
    const rect: Graphic = {
      kind: 'rect',
      key: leaf.data.id,
      x,
      y,
      width,
      height,
      fill: nodePaint(leaf, mark, path, context),
      stroke: 'none',
      opacity: mark.opacity ?? 0.9,
      ...withTitle(titles.get(leaf.data.id)),
    };
    const roomy = (mark.labels ?? true) && width > 44 && height > LABEL + 8;
    const label: ReadonlyArray<Graphic> = roomy
      ? [
          {
            kind: 'text',
            key: `${leaf.data.id}:label`,
            x: x + 4,
            y: y + LABEL + 2,
            text: leaf.data.name,
            fill: 'white',
            anchor: 'start',
            opacity: 0.95,
          },
        ]
      : [];
    return [rect, ...label];
  });
}

export function sunburstGraphics(
  mark: SunburstMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics {
  const { bounds } = context;
  const radius = Math.min(bounds.width, bounds.height) / 2;
  const centre = [bounds.left + bounds.width / 2, bounds.top + bounds.height / 2] as const;
  const root = partition(treeOf(mark, rows, path), { width: 2 * Math.PI, height: radius });
  const nodes = descendants(root).filter((node) => node.depth > 0);
  return nodes.flatMap((node): ReadonlyArray<Graphic> => {
    const config = {
      innerRadius: node.y0,
      outerRadius: node.y1 - 1,
      startAngle: node.x0,
      endAngle: node.x1,
      padAngle: 0.004,
    };
    const slice: Graphic = {
      kind: 'path',
      key: node.data.id,
      d: arc(config),
      translate: centre,
      fill: nodePaint(node, mark, path, context),
      stroke: 'none',
      strokeWidth: 0,
      opacity: (mark.opacity ?? 1) * (node.depth === 1 ? 0.95 : 0.7),
      title: `${node.data.id}: ${node.value}`,
    };
    const span = (node.x1 - node.x0) * ((node.y0 + node.y1) / 2);
    if (!(mark.labels ?? true) || span < 36 || node.y1 - node.y0 < LABEL + 4) return [slice];
    const [cx, cy] = arcCentroid(config);
    return [
      slice,
      {
        kind: 'text',
        key: `${node.data.id}:label`,
        x: centre[0] + cx,
        y: centre[1] + cy + 4,
        text: node.data.name,
        fill: 'white',
        anchor: 'middle',
        opacity: 0.95,
      },
    ];
  });
}

// ── Flows ─────────────────────────────────────────────────────────────────────

export function sankeyGraphics(
  mark: SankeyMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics {
  const { bounds } = context;
  const sources = read(rows, mark.source, `${path}.source`),
    targets = read(rows, mark.target, `${path}.target`);
  const values = read(rows, mark.value, `${path}.value`).map(numeric);
  const links = rows.flatMap((_, i) => {
    const source = sources[i],
      target = targets[i],
      value = values[i] ?? Number.NaN;
    return source === null ||
      source === undefined ||
      target === null ||
      target === undefined ||
      !(value > 0)
      ? []
      : [{ source: String(source), target: String(target), value }];
  });
  const ids: string[] = [];
  for (const link of links)
    for (const id of [link.source, link.target]) if (!ids.includes(id)) ids.push(id);
  const layout = sankey(
    ids.map((id) => ({ id })),
    links,
    {
      width: bounds.width,
      height: bounds.height,
      nodeWidth: mark.nodeWidth ?? 14,
      nodePadding: mark.nodePadding ?? 12,
    },
  );
  const paint = (id: string) => context.color?.paint(id) ?? 'currentColor';
  const placed = new Map(layout.nodes.map((node) => [node.id, node]));
  const nodes = ids.flatMap((id): ReadonlyArray<Graphic> => {
    const node = placed.get(id);
    if (node === undefined) return [];
    const x = bounds.left + node.x0,
      y = bounds.top + node.y0;
    const rect: Graphic = {
      kind: 'rect',
      key: `node:${id}`,
      x,
      y,
      width: node.x1 - node.x0,
      height: node.y1 - node.y0,
      fill: paint(id),
      stroke: 'none',
      opacity: 1,
      title: `${id}: ${node.value}`,
    };
    const last = node.column === node.maxColumn;
    const label: ReadonlyArray<Graphic> =
      (mark.labels ?? true)
        ? [
            {
              kind: 'text',
              key: `node:${id}:label`,
              x: last ? x - 6 : bounds.left + node.x1 + 6,
              y: y + (node.y1 - node.y0) / 2 + 4,
              text: id,
              fill: 'currentColor',
              anchor: last ? 'end' : 'start',
              opacity: 1,
            },
          ]
        : [];
    return [rect, ...label];
  });
  const ribbons = layout.links.map(
    (link, i): Graphic => ({
      kind: 'path',
      key: `link:${i}`,
      d: link.pathD,
      translate: [bounds.left, bounds.top],
      fill: paint(link.sourceId),
      stroke: 'none',
      strokeWidth: 0,
      opacity: mark.opacity ?? 0.35,
      title: `${link.sourceId} → ${link.targetId}: ${link.value}`,
    }),
  );
  // Ribbons first, so nodes and labels draw over them.
  return [
    ...ribbons,
    ...nodes.filter((g) => g.kind === 'rect'),
    ...nodes.filter((g) => g.kind === 'text'),
  ];
}

// ── Parallel coordinates ──────────────────────────────────────────────────────

const HEADER = 18;
/** Tick text; four-digit values such as years stay ungrouped. */
const label = (value: number): string =>
  value.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    useGrouping: Math.abs(value) >= 10_000,
  });

export function parallelGraphics(
  mark: ParallelMark,
  rows: ReadonlyArray<Row>,
  path: string,
  index: number,
  context: Context,
): Graphics {
  const { bounds } = context;
  if (!Array.isArray(mark.dimensions) || mark.dimensions.length === 0)
    fail(`${path}.dimensions`, 'a parallel mark needs at least one field');
  const top = bounds.top + HEADER,
    bottom = bounds.bottom;
  const axes = mark.dimensions.map((field, d) => {
    const values = read(rows, field, `${path}.dimensions[${d}]`);
    if (!values.every((v) => v === null || Number.isFinite(numeric(v))))
      fail(`${path}.dimensions[${d}]`, `field "${field}" must hold numbers`);
    const numbers = values.map(numeric);
    const finite = numbers.filter(Number.isFinite);
    const [lo, hi] = spanOf(finite) ?? [0, 0];
    const x =
      mark.dimensions.length === 1
        ? bounds.left + bounds.width / 2
        : bounds.left + (bounds.width * d) / (mark.dimensions.length - 1);
    const project = (v: number) =>
      hi === lo ? (top + bottom) / 2 : bottom - ((v - lo) / (hi - lo)) * (bottom - top);
    return { field, x, numbers, lo, hi, project };
  });
  const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'currentColor');
  const titles = titlesOf(rows, mark.title, `${path}.title`);
  const keys = keysOf(rows, mark, index);
  const polylines = rows.flatMap((_, i): ReadonlyArray<Graphic> => {
    const points = axes.map((a) => [a.x, a.project(a.numbers[i] ?? Number.NaN)] as const);
    const d = line(points, { defined: (p) => p.every(Number.isFinite) }) ?? '';
    return d === ''
      ? []
      : [
          {
            kind: 'path',
            key: keys[i] ?? `${index}:${i}`,
            d,
            fill: 'none',
            stroke: strokes[i] ?? 'currentColor',
            strokeWidth: mark.strokeWidth ?? 1.5,
            opacity: mark.opacity ?? 0.8,
            ...withTitle(titles[i]),
          },
        ];
  });
  const furniture = axes.flatMap((a): ReadonlyArray<Graphic> => {
    const anchor = a.x >= bounds.right - 1 ? 'end' : 'start';
    const ticks = a.hi > a.lo ? linearTicks([a.lo, a.hi], 4) : [a.lo];
    return [
      {
        kind: 'line',
        key: `axis:${a.field}`,
        x1: a.x,
        x2: a.x,
        y1: top,
        y2: bottom,
        stroke: 'currentColor',
        strokeWidth: 1,
        opacity: 0.45,
      },
      {
        kind: 'text',
        key: `axis:${a.field}:label`,
        x: a.x,
        y: bounds.top + 11,
        text: a.field,
        fill: 'currentColor',
        anchor: a.x <= bounds.left + 1 ? 'start' : anchor === 'end' ? 'end' : 'middle',
        opacity: 1,
      },
      ...ticks.map(
        (t): Graphic => ({
          kind: 'text',
          key: `axis:${a.field}:${t}`,
          x: a.x + (anchor === 'end' ? -4 : 4),
          y: a.project(t) + 4,
          text: label(t),
          fill: 'currentColor',
          anchor,
          opacity: 0.6,
        }),
      ),
    ];
  });
  return [...furniture, ...polylines];
}
