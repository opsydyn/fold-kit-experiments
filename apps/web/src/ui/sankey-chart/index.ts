import { tableau10 } from '@opsydyn/foldkit-viz/math/schemes';
import { sankey } from '@opsydyn/foldkit-viz/shape/sankey';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

import { svgRoot } from '../shared';

// MODEL

export type NodeMeta = Readonly<{ id: string; label: string; color?: string }>;

export type InitConfig = Readonly<{
  nodes: ReadonlyArray<NodeMeta>;
  scheme?: ReadonlyArray<string>;
  links: ReadonlyArray<Readonly<{ source: string; target: string; value: number }>>;
  nodeWidth?: number;
  nodePadding?: number;
}>;

// DIMENSIONS

const W = 480;
const H = 265;
const ML = 64;
const MR = 64;
const MT = 8;
const MB = 8;
const PW = W - ML - MR;
const PH = H - MT - MB;
const NODE_WIDTH = 14;
const NODE_PADDING = 8;

function tint(hex: string, t: number): string {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

type ComputedNode = Readonly<{
  id: string;
  label: string;
  color: string;
  column: number;
  maxColumn: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  // Label positioning
  labelX: number;
  labelY: number;
  labelAnchor: string;
  labelRotate: number; // degrees; -90 for vertical middle nodes
  showLabel: boolean;
}>;

type ComputedLink = Readonly<{
  key: string;
  sourceId: string;
  targetId: string;
  value: number;
  width: number;
  fillColor: string;
  strokeColor: string;
  pathD: string;
}>;

type Layout = Readonly<{
  nodes: ReadonlyArray<ComputedNode>;
  links: ReadonlyArray<ComputedLink>;
}>;

export type Model = Readonly<{
  layout: Layout;
  activeNodeId: Option.Option<string>;
}>;

const r1 = (n: number) => Math.round(n * 10) / 10;

function buildLayout(cfg: InitConfig): Layout {
  const nodeWidth = cfg.nodeWidth ?? NODE_WIDTH;
  const nodePadding = cfg.nodePadding ?? NODE_PADDING;

  const { nodes: sankeyNodes, links: sankeyLinks } = sankey(
    cfg.nodes.map((n) => ({ id: n.id })),
    cfg.links,
    { width: PW, height: PH, nodeWidth, nodePadding, iterations: 6 },
  );

  const metaMap = new Map(cfg.nodes.map((n) => [n.id, n]));

  const computedNodes: ComputedNode[] = sankeyNodes.map((sn, i) => {
    const scheme = cfg.scheme ?? tableau10;
    const metaEntry = metaMap.get(sn.id);
    const color = metaEntry?.color ?? scheme[i % scheme.length] ?? '#94a3b8';
    const meta = { id: sn.id, label: metaEntry?.label ?? sn.id, color };
    const nodeH = sn.y1 - sn.y0;
    const midY = r1(sn.y0 + nodeH / 2);
    const midX = r1((sn.x0 + sn.x1) / 2);

    const isLeft = sn.column === 0;
    const isRight = sn.column === sn.maxColumn;
    const isMiddle = !isLeft && !isRight;

    let labelX: number;
    let labelY: number;
    let labelAnchor: string;
    let labelRotate: number;

    if (isLeft) {
      labelX = sn.x0 - 5;
      labelY = midY;
      labelAnchor = 'end';
      labelRotate = 0;
    } else if (isRight) {
      labelX = sn.x1 + 5;
      labelY = midY;
      labelAnchor = 'start';
      labelRotate = 0;
    } else {
      // Middle: rotated label centred inside node
      labelX = midX;
      labelY = midY;
      labelAnchor = 'middle';
      labelRotate = -90;
    }

    // Only show label when there's enough space (for rotated: node height; for flat: always)
    const minH = isMiddle ? meta.label.length * 5.5 : 0;
    const showLabel = isMiddle ? nodeH >= minH : true;

    return {
      id: sn.id,
      label: meta.label,
      color: meta.color,
      column: sn.column,
      maxColumn: sn.maxColumn,
      x0: sn.x0,
      y0: sn.y0,
      x1: sn.x1,
      y1: sn.y1,
      labelX: r1(labelX),
      labelY: r1(labelY),
      labelAnchor,
      labelRotate,
      showLabel,
    };
  });

  const nodeColorMap = new Map(computedNodes.map((n) => [n.id, n.color]));
  const computedLinks: ComputedLink[] = sankeyLinks.map((sl, i) => {
    const srcColor = nodeColorMap.get(sl.sourceId) ?? '#94a3b8';
    return {
      key: `${sl.sourceId}-${sl.targetId}-${i}`,
      sourceId: sl.sourceId,
      targetId: sl.targetId,
      value: sl.value,
      width: sl.width,
      fillColor: tint(srcColor, 0.45),
      strokeColor: tint(srcColor, 0.2),
      pathD: sl.pathD,
    };
  });

  return { nodes: computedNodes, links: computedLinks };
}

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [{ layout: buildLayout(cfg), activeNodeId: Option.none() }, []];
}

// MESSAGE

export const HoveredNode = m('HoveredNode', { id: Schema.String });
export const BlurredNode = m('BlurredNode', {});

export const Message = Schema.Union([HoveredNode, BlurredNode]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredNode: ({ id }) => [{ ...model, activeNodeId: Option.some(id) }, []],
      BlurredNode: () => [{ ...model, activeNodeId: Option.none() }, []],
    }),
  );

// VIEW

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Sankey diagram' } = config;
  const { layout, activeNodeId } = model;
  const { nodes, links } = layout;

  const isAnyActive = Option.isSome(activeNodeId);
  const activeId = isAnyActive ? activeNodeId.value : null;

  // For link opacity: a link is "related" if either endpoint matches the active node
  const isLinkRelated = (link: ComputedLink) =>
    link.sourceId === activeId || link.targetId === activeId;

  // For node opacity: a node is "related" if it is the active node or connected to it via a link
  const relatedNodeIds = isAnyActive
    ? new Set([
        activeId,
        ...links.filter((l) => isLinkRelated(l)).flatMap((l) => [l.sourceId, l.targetId]),
      ])
    : null;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // Links (drawn first so nodes sit on top)
        ...links.map((link) => {
          const related = !isAnyActive || isLinkRelated(link);
          const opacity = !isAnyActive ? '0.5' : related ? '0.75' : '0.06';
          return h.path(
            [
              h.D(link.pathD),
              h.Fill(related && isAnyActive ? link.strokeColor : link.fillColor),
              h.Stroke(link.strokeColor),
              h.StrokeWidth('0.5'),
              h.Style({ opacity, transition: 'opacity 150ms' }),
            ],
            [],
          );
        }),

        // Nodes
        ...nodes.map((node) => {
          const related = !relatedNodeIds || relatedNodeIds.has(node.id);
          const isActive = node.id === activeId;
          const nodeOpacity = !isAnyActive ? '1' : related ? '1' : '0.3';
          const nodeH = r1(node.y1 - node.y0);

          return h.g(
            [
              h.OnMouseEnter(toParentMessage(HoveredNode({ id: node.id }))),
              h.OnMouseLeave(toParentMessage(BlurredNode())),
              h.Style({ cursor: 'pointer' }),
              h.AriaLabel(node.label),
            ],
            [
              h.rect(
                [
                  h.X(String(node.x0)),
                  h.Y(String(node.y0)),
                  h.Width(String(r1(node.x1 - node.x0))),
                  h.Height(String(nodeH)),
                  h.Fill(node.color),
                  h.Style({
                    opacity: nodeOpacity,
                    transition: 'opacity 150ms',
                  }),
                ],
                [],
              ),
              // Label
              ...(node.showLabel
                ? [
                    h.text(
                      [
                        h.Transform(
                          node.labelRotate !== 0
                            ? `translate(${node.labelX},${node.labelY}) rotate(${node.labelRotate})`
                            : `translate(0,0)`,
                        ),
                        h.X(node.labelRotate !== 0 ? '0' : String(node.labelX)),
                        h.Y(node.labelRotate !== 0 ? '0' : String(node.labelY)),
                        h.Style({
                          'text-anchor': node.labelAnchor,
                          'dominant-baseline': 'middle',
                          'font-size': '0.6rem',
                          'font-weight': isActive ? '700' : '500',
                          fill: isActive ? node.color : '#475569',
                          opacity: !isAnyActive ? '1' : related ? '1' : '0.3',
                          transition: 'opacity 150ms, fill 150ms',
                          'pointer-events': 'none',
                          'user-select': 'none',
                        }),
                      ],
                      [node.label],
                    ),
                  ]
                : []),
            ],
          );
        }),
      ],
    ),
  ]);
};
