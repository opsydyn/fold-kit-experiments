import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, r3, svgRoot } from '../shared';

// MODEL — network links as arcs above a linear node axis

export type ArcNode = Readonly<{ id: string; label: string }>;
export type ArcLink = Readonly<{ source: string; target: string; weight?: number }>;

export type InitConfig = Readonly<{
  nodes: ReadonlyArray<ArcNode>;
  links: ReadonlyArray<ArcLink>;
  color?: string;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type Model = Readonly<{
  nodes: ReadonlyArray<ArcNode>;
  links: ReadonlyArray<ArcLink>;
  color: string;
  activeId: Option.Option<string>;
  readonly layout: Layout;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: 220, ...cfg.dims },
    { top: 24, right: 24, bottom: 40, left: 24, ...cfg.margins },
  );
  return [
    {
      nodes: cfg.nodes,
      links: cfg.links,
      color: cfg.color ?? '#6366f1',
      activeId: Option.none(),
      layout,
    },
    [],
  ];
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
      HoveredNode: ({ id }) => [{ ...model, activeId: Option.some(id) }, []],
      BlurredNode: () => [{ ...model, activeId: Option.none() }, []],
    }),
  );

// VIEW

function arcPath(x1: number, x2: number, y: number): string {
  const mx = (x1 + x2) / 2;
  const height = Math.abs(x2 - x1) * 0.4;
  return `M${r3(x1)},${r3(y)} C${r3(mx)},${r3(y - height)} ${r3(mx)},${r3(y - height)} ${r3(x2)},${r3(y)}`;
}

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Arc diagram' } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { nodes, links, color, activeId } = model;

  const active = Option.isSome(activeId) ? activeId.value : null;
  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));

  const xScale = linear({
    domain: [0, nodes.length - 1],
    range: [0, PW],
  });

  const nodeY = PH; // axis sits at bottom of plot area
  const DOT_R = 5;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // Axis line
        h.line(
          [
            h.X1('0'),
            h.Y1(String(nodeY)),
            h.X2(String(PW)),
            h.Y2(String(nodeY)),
            h.Stroke('var(--chart-axis, #3a3a3a)'),
            h.StrokeWidth('1'),
          ],
          [],
        ),

        // Arc links
        h.g(
          [],
          links.map((link, _li) => {
            const si = nodeIndex.get(link.source) ?? 0;
            const ti = nodeIndex.get(link.target) ?? 0;
            const x1 = r3(xScale(si));
            const x2 = r3(xScale(ti));
            const isRelated = active !== null && (link.source === active || link.target === active);
            const isDimmed = active !== null && !isRelated;
            const strokeW = link.weight ? r3(0.5 + link.weight * 1.5) : 1.5;

            return h.path(
              [
                h.D(arcPath(x1, x2, nodeY)),
                h.Fill('none'),
                h.Stroke(color),
                h.StrokeWidth(String(strokeW)),
                h.Opacity(isDimmed ? '0.08' : isRelated ? '1' : '0.35'),
                h.Style({ transition: 'opacity 150ms' }),
                h.AriaLabel(`${link.source} → ${link.target}`),
              ],
              [],
            );
          }),
        ),

        // Node dots + labels
        h.g(
          [],
          nodes.map((node, i) => {
            const cx = r3(xScale(i));
            const isActive = active === node.id;
            const isDimmed = active !== null && !isActive;
            const hasLink = links.some((l) => l.source === node.id || l.target === node.id);

            return h.g(
              [
                h.OnMouseEnter(toParentMessage(HoveredNode({ id: node.id }))),
                h.OnMouseLeave(toParentMessage(BlurredNode())),
                h.Style({
                  cursor: 'pointer',
                  opacity: isDimmed ? '0.3' : '1',
                  transition: 'opacity 150ms',
                }),
                h.AriaLabel(node.label),
              ],
              [
                h.circle(
                  [
                    h.Cx(String(cx)),
                    h.Cy(String(nodeY)),
                    h.R(String(isActive ? DOT_R + 2 : DOT_R)),
                    h.Fill(isActive ? color : hasLink ? color : 'var(--chart-axis, #3a3a3a)'),
                    h.Stroke(isActive ? 'var(--card-bg, #12121f)' : 'none'),
                    h.StrokeWidth('2'),
                    h.Opacity(hasLink ? '1' : '0.4'),
                    h.Style({ transition: 'r 120ms' }),
                  ],
                  [],
                ),
                h.text(
                  [
                    h.X(String(cx)),
                    h.Y(String(nodeY + 16)),
                    h.Style({
                      'text-anchor': 'middle',
                      'dominant-baseline': 'hanging',
                      'font-size': isActive ? '0.72rem' : '0.65rem',
                      'font-weight': isActive ? '700' : '400',
                      fill: isActive ? color : 'var(--chart-label, #888)',
                      transition: 'font-size 80ms',
                    }),
                  ],
                  [node.label],
                ),
              ],
            );
          }),
        ),
      ],
    ),
  ]);
}
