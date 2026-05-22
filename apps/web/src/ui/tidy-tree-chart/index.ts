import type { TreeLayoutNode } from '@opsydyn/foldkit-viz/hierarchy';
import { hierarchy, treeLayout } from '@opsydyn/foldkit-viz/hierarchy';
import { linkVertical } from '@opsydyn/foldkit-viz/shape/link';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

// MODEL

export type TreeDatum = Readonly<{
  name: string;
  children?: ReadonlyArray<TreeDatum>;
}>;

export type InitConfig = Readonly<{
  data: TreeDatum;
  width?: number;
  height?: number;
  nodeRadius?: number;
  color?: string;
}>;

export type LayoutNode = TreeLayoutNode<TreeDatum>;

export type Model = Readonly<{
  nodes: ReadonlyArray<LayoutNode>;
  links: ReadonlyArray<Readonly<{ source: LayoutNode; target: LayoutNode }>>;
  activeId: Option.Option<string>;
  width: number;
  height: number;
  nodeRadius: number;
  color: string;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const w = cfg.width ?? 440;
  const h = cfg.height ?? 220;
  const root = hierarchy(cfg.data as TreeDatum);
  const nodes = treeLayout(root, { width: w, height: h });

  const links: Array<Readonly<{ source: LayoutNode; target: LayoutNode }>> = [];
  for (const node of nodes) {
    if (node.children) {
      for (const child of node.children) {
        links.push({ source: node, target: child });
      }
    }
  }

  return [
    {
      nodes,
      links,
      activeId: Option.none(),
      width: w,
      height: h,
      nodeRadius: cfg.nodeRadius ?? 4,
      color: cfg.color ?? '#6366f1',
    },
    [],
  ];
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
      HoveredNode: ({ name }) => [{ ...model, activeId: Option.some(name) }, []],
      BlurredNode: () => [{ ...model, activeId: Option.none() }, []],
    }),
  );

// VIEW

const W = 480;
const H = 265;
const MT = 24;
const MR = 20;
const MB = 24;
const ML = 20;
const PW = W - ML - MR;
const PH = H - MT - MB;

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Tidy tree diagram' } = config;
  const { nodes, links, activeId, nodeRadius, color } = model;

  // Scale layout coords (0..model.width/height) → plot area
  const scaleX = (x: number) => (x / model.width) * PW;
  const scaleY = (y: number) => (y / model.height) * PH;

  const activeNode = Option.isSome(activeId) ? activeId.value : null;

  return h.svg(
    [
      h.ViewBox(`0 0 ${W} ${H}`),
      h.Width('100%'),
      h.Role('img'),
      h.AriaLabel(ariaLabel),
      h.Style({ display: 'block', 'font-family': 'inherit' }),
    ],
    [
      h.g(
        [h.Transform(`translate(${ML},${MT})`)],
        [
          // Links
          h.g(
            [],
            links.map(({ source, target }) =>
              h.path(
                [
                  h.D(
                    linkVertical(
                      { x: scaleX(source.x), y: scaleY(source.y) },
                      { x: scaleX(target.x), y: scaleY(target.y) },
                    ),
                  ),
                  h.Fill('none'),
                  h.Stroke('#cbd5e1'),
                  h.StrokeWidth('1.5'),
                ],
                [],
              ),
            ),
          ),

          // Nodes
          h.g(
            [],
            nodes.map((node) => {
              const cx = scaleX(node.x);
              const cy = scaleY(node.y);
              const isActive = node.data.name === activeNode;
              const isLeaf = !node.children || node.children.length === 0;
              const labelBelow = cy < PH - 20;

              return h.g(
                [
                  h.Transform(`translate(${cx},${cy})`),
                  h.OnMouseEnter(toParentMessage(HoveredNode({ name: node.data.name }))),
                  h.OnMouseLeave(toParentMessage(BlurredNode({}))),
                  h.Style({ cursor: 'default' }),
                ],
                [
                  h.circle(
                    [
                      h.Cx('0'),
                      h.Cy('0'),
                      h.R(String(isActive ? nodeRadius + 2 : nodeRadius)),
                      h.Fill(isLeaf ? '#fff' : color),
                      h.Stroke(color),
                      h.StrokeWidth('1.5'),
                      h.Style({ transition: 'r 80ms' }),
                    ],
                    [],
                  ),
                  h.text(
                    [
                      h.X('0'),
                      h.Y(labelBelow ? String(nodeRadius + 10) : String(-(nodeRadius + 4))),
                      h.Style({
                        'text-anchor': 'middle',
                        'dominant-baseline': labelBelow ? 'hanging' : 'auto',
                        'font-size': isActive ? '0.65rem' : '0.58rem',
                        'font-weight': isActive ? '600' : '400',
                        fill: isActive ? color : '#64748b',
                        'pointer-events': 'none',
                        transition: 'font-size 80ms',
                      }),
                    ],
                    [node.data.name],
                  ),
                ],
              );
            }),
          ),
        ],
      ),
    ],
  );
}
