import type { ForceLayout, LayoutLink, LayoutNode } from '@opsydyn/foldkit-viz/simulation';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { r3, svgRoot } from '../shared';

// MODEL

export type Node = Readonly<{ id: string; label: string }>;
export type Link = Readonly<{ source: string; target: string }>;

export type Config = Readonly<{
  color: string;
  activeColor: string;
  nodeRadius: number;
  width: number;
  height: number;
}>;

export type Model = Readonly<{
  nodes: ReadonlyArray<Node & LayoutNode>;
  links: ReadonlyArray<Link & LayoutLink>;
  activeId: Option.Option<string>;
  config: Config;
}>;

export type InitConfig = Readonly<{
  layout: ForceLayout;
  nodeMeta: ReadonlyArray<Node>;
  links: ReadonlyArray<Link>;
  config?: Partial<Config>;
}>;

const DEFAULT_CONFIG: Config = {
  color: '#06b6d4',
  activeColor: '#0891b2',
  nodeRadius: 10,
  width: 480,
  height: 280,
};

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const conf = { ...DEFAULT_CONFIG, ...cfg.config };
  const metaMap = new Map(cfg.nodeMeta.map((n) => [n.id, n]));

  const nodes = cfg.layout.nodes.map((ln) => {
    const meta = metaMap.get(ln.id) ?? { id: ln.id, label: ln.id };
    return { ...ln, ...meta };
  });

  const layoutLinkMap = new Map(
    cfg.layout.links.map((ll) => [`${ll.sourceId}→${ll.targetId}`, ll]),
  );

  const links = cfg.links.flatMap((l) => {
    const ll =
      layoutLinkMap.get(`${l.source}→${l.target}`) ?? layoutLinkMap.get(`${l.target}→${l.source}`);
    if (!ll) return [];
    return [{ ...l, ...ll, sourceId: l.source, targetId: l.target }];
  });

  return [{ nodes, links, activeId: Option.none(), config: conf }, []];
}

// MESSAGE

export const HoveredNode = m('HoveredNode', { id: Schema.String });
export const BlurredNode = m('BlurredNode', {});
export const PressedKeyNav = m('PressedKeyNav', { direction: Schema.String });

export const Message = Schema.Union([HoveredNode, BlurredNode, PressedKeyNav]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredNode: ({ id }) => [{ ...model, activeId: Option.some(id) }, []],
      BlurredNode: () => [{ ...model, activeId: Option.none() }, []],
      PressedKeyNav: ({ direction }) => {
        const ids = model.nodes.map((n) => n.id);
        const current = Option.isSome(model.activeId) ? ids.indexOf(model.activeId.value) : -1;
        const n = ids.length;
        const next = direction === 'next' ? (current + 1) % n : (current - 1 + n) % n;
        return [{ ...model, activeId: Option.some(ids[next] ?? ids[0] ?? '') }, []];
      },
    }),
  );

// VIEW

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Force-directed graph' } = config;
  const { nodes, links, activeId, config: cfg } = model;

  const activeIdVal = Option.isSome(activeId) ? activeId.value : null;

  // Precompute neighbor set for the active node
  const neighborIds = new Set<string>();
  if (activeIdVal) {
    for (const l of links) {
      if (l.sourceId === activeIdVal) neighborIds.add(l.targetId);
      else if (l.targetId === activeIdVal) neighborIds.add(l.sourceId);
    }
  }

  const isConnected = (l: LayoutLink) =>
    activeIdVal && (l.sourceId === activeIdVal || l.targetId === activeIdVal);

  const handleKeyDown = (key: string): Option.Option<M> => {
    if (key === 'ArrowRight')
      return Option.some(toParentMessage(PressedKeyNav({ direction: 'next' })));
    if (key === 'ArrowLeft')
      return Option.some(toParentMessage(PressedKeyNav({ direction: 'prev' })));
    return Option.none();
  };

  return svgRoot(
    h,
    { width: cfg.width, height: cfg.height, ariaLabel, interactive: true },
    handleKeyDown,
    [
      // Edges
      h.g(
        [],
        links.map((l) => {
          const connected = isConnected(l);
          const dimmed = activeIdVal && !connected;
          return h.line(
            [
              h.X1(String(r3(l.x1))),
              h.Y1(String(r3(l.y1))),
              h.X2(String(r3(l.x2))),
              h.Y2(String(r3(l.y2))),
              h.Stroke(connected ? cfg.activeColor : '#cbd5e1'),
              h.StrokeWidth(connected ? '2' : '1'),
              h.Style({
                opacity: dimmed ? '0.3' : '1',
                transition: 'stroke 120ms, opacity 120ms',
              }),
            ],
            [],
          );
        }),
      ),

      // Nodes
      h.g(
        [],
        nodes.map((n) => {
          const isActive = n.id === activeIdVal;
          const isNeighbor = neighborIds.has(n.id);
          const hasFocus = activeIdVal !== null;
          const r = isActive ? cfg.nodeRadius + 4 : cfg.nodeRadius;

          const fillColor = isActive
            ? cfg.activeColor
            : isNeighbor
              ? `${cfg.color}cc`
              : hasFocus
                ? 'var(--card-bg, #12121f)'
                : 'var(--card-bg, #12121f)';

          const strokeColor = isActive
            ? cfg.activeColor
            : isNeighbor
              ? cfg.color
              : hasFocus
                ? '#94a3b8'
                : cfg.color;

          const opacity = hasFocus && !isActive && !isNeighbor ? '0.4' : '1';

          return h.g(
            [
              h.OnMouseEnter(toParentMessage(HoveredNode({ id: n.id }))),
              h.OnMouseLeave(toParentMessage(BlurredNode({}))),
              h.Style({ cursor: 'pointer' }),
              h.AriaLabel(`${n.label}`),
            ],
            [
              // Hit area
              h.circle(
                [
                  h.Cx(String(r3(n.x))),
                  h.Cy(String(r3(n.y))),
                  h.R(String(r + 6)),
                  h.Fill('transparent'),
                ],
                [],
              ),
              // Visual node
              h.circle(
                [
                  h.Cx(String(r3(n.x))),
                  h.Cy(String(r3(n.y))),
                  h.R(String(r)),
                  h.Fill(fillColor),
                  h.Stroke(strokeColor),
                  h.StrokeWidth('2'),
                  h.Style({ opacity, transition: 'r 120ms, fill 120ms, opacity 120ms' }),
                ],
                [],
              ),
              // Label
              h.text(
                [
                  h.X(String(r3(n.x))),
                  h.Y(String(r3(n.y + r + 13))),
                  h.Style({
                    'text-anchor': 'middle',
                    'dominant-baseline': 'hanging',
                    'font-size': isActive ? '0.72rem' : '0.6rem',
                    'font-weight': isActive ? '600' : '400',
                    fill: isActive
                      ? cfg.activeColor
                      : hasFocus && !isNeighbor
                        ? '#94a3b8'
                        : '#475569',
                    opacity,
                    transition: 'font-size 120ms, fill 120ms, opacity 120ms',
                    'pointer-events': 'none',
                    'user-select': 'none',
                  }),
                ],
                [n.label],
              ),
            ],
          );
        }),
      ),
    ],
  );
};
