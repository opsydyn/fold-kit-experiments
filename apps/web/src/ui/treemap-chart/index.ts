import { descendants, hierarchy, leaves, sort, sum, treemap } from '@opsydyn/foldkit-viz/hierarchy';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { svgRoot } from '../shared';

// MODEL

export type LeafDatum = Readonly<{ name: string; value: number }>;
export type CategoryDatum = Readonly<{
  name: string;
  color: string;
  children: ReadonlyArray<LeafDatum>;
}>;
export type RootDatum = Readonly<{ name: string; children: ReadonlyArray<CategoryDatum> }>;

type ComputedCatNode = Readonly<{
  name: string;
  color: string;
  bgColor: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  leafNames: ReadonlyArray<string>;
}>;

type ComputedLeafNode = Readonly<{
  name: string;
  value: number;
  catColor: string;
  tintedColor: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}>;

type Layout = Readonly<{
  catNodes: ReadonlyArray<ComputedCatNode>;
  leafNodes: ReadonlyArray<ComputedLeafNode>;
}>;

export type Model = Readonly<{
  layout: Layout;
  activeNode: Option.Option<string>;
}>;

export type InitConfig = Readonly<{ root: RootDatum }>;

// VIEW CONSTANTS (needed in both buildLayout and view)

const W = 480;
const H = 280;
const PAD_OUTER = 2;
const PAD_INNER = 2;
const MIN_LABEL_W = 36;
const MIN_LABEL_H = 18;

const r1 = (n: number) => Math.round(n * 10) / 10;

function tint(hex: string, t: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function buildLayout(root: RootDatum): Layout {
  const rootNode = hierarchy(root as { name: string; children: CategoryDatum[] });
  sum(rootNode, (d) => ('value' in d && typeof d.value === 'number' ? d.value : 0));
  sort(rootNode, (a, b) => b.value - a.value);
  treemap(rootNode, {
    width: W,
    height: H,
    paddingOuter: PAD_OUTER,
    paddingInner: PAD_INNER,
    paddingTop: 18,
    round: true,
  });

  const allNodes = descendants(rootNode);
  const leafNodesRaw = leaves(rootNode);

  const catNodes: ComputedCatNode[] = allNodes
    .filter((n) => n.depth === 1 && n.children)
    .map((catNode) => {
      const datum = catNode.data as unknown as CategoryDatum;
      const leafNames = leafNodesRaw
        .filter((l) => l.parent === catNode)
        .map((l) => (l.data as unknown as LeafDatum).name);
      return {
        name: datum.name,
        color: datum.color,
        bgColor: tint(datum.color, 0.85),
        x0: catNode.x0,
        y0: catNode.y0,
        x1: catNode.x1,
        y1: catNode.y1,
        leafNames,
      };
    });

  const leafNodes: ComputedLeafNode[] = leafNodesRaw.map((leafNode) => {
    const datum = leafNode.data as unknown as LeafDatum;
    const parentDatum = (leafNode.parent?.data ?? {}) as unknown as CategoryDatum;
    const catColor = root.children.find((c) => c.name === parentDatum.name)?.color ?? '#94a3b8';
    return {
      name: datum.name,
      value: datum.value,
      catColor,
      tintedColor: tint(catColor, 0.35),
      x0: leafNode.x0,
      y0: leafNode.y0,
      x1: leafNode.x1,
      y1: leafNode.y1,
    };
  });

  return { catNodes, leafNodes };
}

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [{ layout: buildLayout(cfg.root), activeNode: Option.none() }, []];
}

// MESSAGE

export const HoveredNode = m('HoveredNode', { name: Schema.String });
export const BlurredNode = m('BlurredNode', {});

export const Message = Schema.Union([HoveredNode, BlurredNode]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredNode: ({ name }) => [{ ...model, activeNode: Option.some(name) }, []],
      BlurredNode: () => [{ ...model, activeNode: Option.none() }, []],
    }),
  );

// VIEW

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Treemap chart' } = config;
  const { layout, activeNode } = model;
  const { catNodes, leafNodes } = layout;

  const isAnyActive = Option.isSome(activeNode);
  const activeValue = isAnyActive ? activeNode.value : null;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    ...catNodes.map((cat) => {
      const w = r1(cat.x1 - cat.x0);
      const ch = r1(cat.y1 - cat.y0);
      const isActive = isAnyActive && cat.leafNames.some((n) => n === activeValue);
      return h.g(
        [h.Transform(`translate(${r1(cat.x0)},${r1(cat.y0)})`)],
        [
          h.rect(
            [
              h.X('0'),
              h.Y('0'),
              h.Width(String(w)),
              h.Height(String(ch)),
              h.Fill(cat.bgColor),
              h.Stroke(cat.color),
              h.StrokeWidth('1'),
              h.Style({ opacity: isAnyActive && !isActive ? '0.5' : '1' }),
            ],
            [],
          ),
          h.text(
            [
              h.X('5'),
              h.Y('12'),
              h.Style({
                'font-size': '0.62rem',
                'font-weight': '700',
                fill: cat.color,
                'letter-spacing': '0.04em',
                'text-transform': 'uppercase',
                'pointer-events': 'none',
              }),
            ],
            [cat.name],
          ),
        ],
      );
    }),

    ...leafNodes.map((leaf) => {
      const w = r1(leaf.x1 - leaf.x0);
      const nodeH = r1(leaf.y1 - leaf.y0);
      const isActive = isAnyActive && activeValue === leaf.name;
      const opacity = !isAnyActive ? '1' : isActive ? '1' : '0.45';
      const showLabel = w >= MIN_LABEL_W && nodeH >= MIN_LABEL_H;

      return h.g(
        [
          h.Transform(`translate(${r1(leaf.x0)},${r1(leaf.y0)})`),
          h.OnMouseEnter(toParentMessage(HoveredNode({ name: leaf.name }))),
          h.OnMouseLeave(toParentMessage(BlurredNode({}))),
          h.Style({ cursor: 'pointer' }),
          h.AriaLabel(`${leaf.name}: ${leaf.value}`),
        ],
        [
          h.rect(
            [
              h.X('0'),
              h.Y('0'),
              h.Width(String(w)),
              h.Height(String(nodeH)),
              h.Fill(isActive ? leaf.catColor : leaf.tintedColor),
              h.Stroke(leaf.catColor),
              h.StrokeWidth(isActive ? '2' : '0.5'),
              h.Style({ opacity, transition: 'opacity 120ms' }),
            ],
            [],
          ),
          ...(showLabel
            ? [
                h.text(
                  [
                    h.X(String(r1(w / 2))),
                    h.Y(String(r1(nodeH / 2))),
                    h.Style({
                      'text-anchor': 'middle',
                      'dominant-baseline': 'middle',
                      'font-size': '0.65rem',
                      'font-weight': '600',
                      fill: isActive ? '#fff' : '#1e293b',
                      'pointer-events': 'none',
                      'user-select': 'none',
                    }),
                  ],
                  [leaf.name],
                ),
                ...(nodeH >= 30
                  ? [
                      h.text(
                        [
                          h.X(String(r1(w / 2))),
                          h.Y(String(r1(nodeH / 2 + 12))),
                          h.Style({
                            'text-anchor': 'middle',
                            'dominant-baseline': 'middle',
                            'font-size': '0.6rem',
                            fill: isActive ? 'rgba(255,255,255,0.8)' : '#64748b',
                            'pointer-events': 'none',
                            'user-select': 'none',
                          }),
                        ],
                        [String(leaf.value)],
                      ),
                    ]
                  : []),
              ]
            : []),
        ],
      );
    }),
  ]);
};
