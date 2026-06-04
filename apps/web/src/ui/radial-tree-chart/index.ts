import type { ClusterLayoutNode } from '@opsydyn/foldkit-viz/hierarchy';
import { clusterLayout, hierarchy } from '@opsydyn/foldkit-viz/hierarchy';
import { linkRadial } from '@opsydyn/foldkit-viz/shape/link';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { r3, svgRoot } from '../shared';

// MODEL

export type TreeDatum = Readonly<{
  name: string;
  children?: ReadonlyArray<TreeDatum>;
}>;

export type InitConfig = Readonly<{
  data: TreeDatum;
  outerRadius?: number;
  color?: string;
}>;

export type LayoutNode = ClusterLayoutNode<TreeDatum>;

export type Model = Readonly<{
  nodes: ReadonlyArray<LayoutNode>;
  links: ReadonlyArray<Readonly<{ source: LayoutNode; target: LayoutNode }>>;
  activeId: Option.Option<string>;
  outerRadius: number;
  color: string;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const outerRadius = cfg.outerRadius ?? 108;
  const root = hierarchy(cfg.data as TreeDatum);
  const nodes = clusterLayout(root, { width: 2 * Math.PI, height: outerRadius });

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
      outerRadius,
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
const CX = W / 2;
const CY = H / 2;


// Convert cluster node (angle, radius) to SVG Cartesian
function cx(node: LayoutNode): number {
  return r3(CX + node.y * Math.sin(node.x));
}
function cy(node: LayoutNode): number {
  return r3(CY - node.y * Math.cos(node.x));
}

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Radial tree diagram' } = config;
  const { nodes, links, activeId, outerRadius, color } = model;

  const activeNode = Option.isSome(activeId) ? activeId.value : null;
  const LABEL_R = outerRadius + 10;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
      // Links — drawn in SVG coords (not angle/radius), shift to center
      h.g(
        [],
        links.map(({ source, target }) =>
          h.path(
            [
              h.D(
                linkRadial(
                  { angle: source.x, radius: source.y },
                  { angle: target.x, radius: target.y },
                ),
              ),
              h.Fill('none'),
              h.Stroke('#cbd5e1'),
              h.StrokeWidth('1.5'),
              h.Transform(`translate(${CX},${CY})`),
            ],
            [],
          ),
        ),
      ),

      // Nodes + labels
      h.g(
        [],
        nodes.map((node) => {
          const x = cx(node);
          const y = cy(node);
          const isActive = node.data.name === activeNode;
          const isLeaf = !node.children || node.children.length === 0;
          const isRoot = node.depth === 0;

          // label position
          const lx = r3(CX + LABEL_R * Math.sin(node.x));
          const ly = r3(CY - LABEL_R * Math.cos(node.x));
          const rightHalf = Math.sin(node.x) >= 0;
          const anchor = isRoot ? 'middle' : rightHalf ? 'start' : 'end';

          return h.g(
            [
              h.OnMouseEnter(toParentMessage(HoveredNode({ name: node.data.name }))),
              h.OnMouseLeave(toParentMessage(BlurredNode({}))),
              h.Style({ cursor: 'default' }),
            ],
            [
              h.circle(
                [
                  h.Cx(String(x)),
                  h.Cy(String(y)),
                  h.R(isRoot ? '4' : isLeaf ? '3' : '3'),
                  h.Fill(isLeaf ? '#fff' : color),
                  h.Stroke(color),
                  h.StrokeWidth('1.5'),
                  h.Opacity(activeNode && !isActive ? '0.3' : '1'),
                  h.Style({ transition: 'opacity 80ms' }),
                ],
                [],
              ),
              // Show label for leaves always, and for any active internal node
              ...(isLeaf || isActive
                ? [
                    h.text(
                      [
                        h.X(String(isLeaf ? lx : x)),
                        h.Y(String(isLeaf ? ly : y - 10)),
                        h.Style({
                          'text-anchor': isLeaf ? anchor : 'middle',
                          'dominant-baseline': 'middle',
                          'font-size': isActive && !isLeaf ? '0.65rem' : '0.58rem',
                          'font-weight': isActive ? '600' : '400',
                          fill: isActive ? color : '#64748b',
                          'pointer-events': 'none',
                        }),
                      ],
                      [node.data.name],
                    ),
                  ]
                : []),
            ],
          );
        }),
      ),
    ],
  );
}
