import { descendants, hierarchy, partition, sort, sum } from '@opsydyn/foldkit-viz/hierarchy';
import { arc, arcCentroid } from '@opsydyn/foldkit-viz/shape/arc';
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

type ComputedCatArc = Readonly<{
  name: string;
  color: string;
  value: number;
  childNames: ReadonlyArray<string>;
}>;

type ComputedLeafArc = Readonly<{
  name: string;
  value: number;
  catColor: string;
  catName: string;
  fillColor: string;
  strokeColor: string;
  pathD: string;
  pathDActive: string;
  showLabel: boolean;
  labelX: number;
  labelY: number;
}>;

type Layout = Readonly<{
  catArcs: ReadonlyArray<ComputedCatArc>;
  leafArcs: ReadonlyArray<ComputedLeafArc>;
  rootName: string;
  centerPath: string;
}>;

export type Model = Readonly<{
  layout: Layout;
  activeNode: Option.Option<string>;
}>;

export type InitConfig = Readonly<{ root: RootDatum }>;

// DIMENSIONS

const W = 300;
const H = 316;
const CX = 150;
const CY = 144;
const TAU = 2 * Math.PI;
const PAD_ANGLE = 0.018;
const MIN_ARC_FOR_LABEL = 0.18;

const LEAF_R0 = 72;
const LEAF_R1 = 128;

const LEG_Y1 = CY + LEAF_R1 + 14;
const LEG_Y2 = LEG_Y1 + 15;
const LEG_X1 = 75;
const LEG_X2 = 225;

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
  partition(rootNode, { width: TAU, height: 1 });

  const catArcs: ComputedCatArc[] = [];
  const leafArcs: ComputedLeafArc[] = [];

  for (const node of descendants(rootNode)) {
    if (node.depth === 0) continue;
    const name = (node.data as { name?: string }).name ?? '';

    if (node.depth === 1) {
      const datum = node.data as unknown as CategoryDatum;
      catArcs.push({
        name,
        color: datum.color ?? '#94a3b8',
        value: node.value,
        childNames: datum.children.map((c) => c.name),
      });
    } else if (node.depth === 2) {
      const catData = node.parent?.data as unknown as CategoryDatum | undefined;
      const catColor = catData?.color ?? '#94a3b8';
      const spanAngle = node.x1 - node.x0;
      const pathD =
        arc({
          startAngle: node.x0,
          endAngle: node.x1,
          innerRadius: LEAF_R0,
          outerRadius: LEAF_R1,
          padAngle: PAD_ANGLE,
        }) ?? '';
      const pathDActive =
        arc({
          startAngle: node.x0,
          endAngle: node.x1,
          innerRadius: LEAF_R0,
          outerRadius: LEAF_R1 + 6,
          padAngle: PAD_ANGLE,
        }) ?? '';
      const [lx, ly] = arcCentroid({
        startAngle: node.x0,
        endAngle: node.x1,
        innerRadius: LEAF_R0,
        outerRadius: LEAF_R1,
      });
      leafArcs.push({
        name,
        value: node.value,
        catColor,
        catName: catData?.name ?? '',
        fillColor: tint(catColor, 0.35),
        strokeColor: tint(catColor, 0.05),
        pathD,
        pathDActive,
        showLabel: spanAngle >= MIN_ARC_FOR_LABEL,
        labelX: Math.round(lx * 10) / 10,
        labelY: Math.round(ly * 10) / 10,
      });
    }
  }

  // Full-radius center disc — rendered last (highest z-order) so it always covers arc antialiasing bleed
  const cr = LEAF_R0;
  const centerPath = `M 0,${-cr} A ${cr},${cr},0,1,1,0,${cr} A ${cr},${cr},0,1,1,0,${-cr} Z`;

  return { catArcs, leafArcs, rootName: root.name, centerPath };
}

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [{ layout: buildLayout(cfg.root), activeNode: Option.none() }, []];
}

// MESSAGE

export const HoveredSegment = m('HoveredSegment', { name: Schema.String });
export const BlurredSegment = m('BlurredSegment', {});

export const Message = Schema.Union([HoveredSegment, BlurredSegment]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredSegment: ({ name }) => [{ ...model, activeNode: Option.some(name) }, []],
      BlurredSegment: () => [{ ...model, activeNode: Option.none() }, []],
    }),
  );

// VIEW

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Sunburst chart' } = config;
  const { layout, activeNode } = model;
  const { catArcs, leafArcs, rootName } = layout;

  const isAnyActive = Option.isSome(activeNode);
  const activeValue = isAnyActive ? activeNode.value : null;
  const activeCatName = activeValue
    ? (leafArcs.find((l) => l.name === activeValue)?.catName ?? null)
    : null;
  const activeLeaf = activeValue ? leafArcs.find((l) => l.name === activeValue) : null;

  const centerLabel = activeLeaf
    ? [
        h.text(
          [
            h.X('0'),
            h.Y('-8'),
            h.Style({
              'text-anchor': 'middle',
              'dominant-baseline': 'middle',
              'font-size': '0.62rem',
              'font-weight': '700',
              fill: '#1e293b',
              'pointer-events': 'none',
              'user-select': 'none',
            }),
          ],
          [activeLeaf.name],
        ),
        h.text(
          [
            h.X('0'),
            h.Y('8'),
            h.Style({
              'text-anchor': 'middle',
              'dominant-baseline': 'middle',
              'font-size': '0.58rem',
              fill: activeLeaf.catColor,
              'pointer-events': 'none',
              'user-select': 'none',
            }),
          ],
          [`${activeLeaf.value}B`],
        ),
      ]
    : [
        h.text(
          [
            h.X('0'),
            h.Y('4'),
            h.Style({
              'text-anchor': 'middle',
              'dominant-baseline': 'middle',
              'font-size': '0.62rem',
              'font-weight': '600',
              fill: '#64748b',
              'pointer-events': 'none',
              'user-select': 'none',
            }),
          ],
          [rootName],
        ),
      ];

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${CX},${CY})`)],
      [
        ...leafArcs.map((a) => {
          const isActive = isAnyActive && a.name === activeValue;
          const isRelated = isAnyActive && !isActive && a.catName !== activeCatName;
          const opacity = !isAnyActive ? '1' : isRelated ? '0.25' : '1';
          return h.g(
            [
              h.Style({ cursor: 'pointer' }),
              h.OnMouseEnter(toParentMessage(HoveredSegment({ name: a.name }))),
              h.OnMouseLeave(toParentMessage(BlurredSegment())),
              h.AriaLabel(`${a.name}: ${a.value}`),
            ],
            [
              h.path(
                [
                  h.D(isActive ? a.pathDActive : a.pathD),
                  h.Fill(isActive ? a.catColor : a.fillColor),
                  h.Stroke(isActive ? a.catColor : a.strokeColor),
                  h.StrokeWidth(isActive ? '1.5' : '0.5'),
                  h.Style({ opacity, transition: 'opacity 120ms, d 80ms' }),
                ],
                [],
              ),
              ...(a.showLabel
                ? [
                    h.text(
                      [
                        h.X(String(a.labelX)),
                        h.Y(String(a.labelY)),
                        h.Style({
                          'text-anchor': 'middle',
                          'dominant-baseline': 'middle',
                          'font-size': '0.58rem',
                          'font-weight': '600',
                          fill: isActive ? 'var(--page-text, #e8e8ff)' : 'var(--chart-label, #888)',
                          'pointer-events': 'none',
                          'user-select': 'none',
                          opacity,
                        }),
                      ],
                      [a.name],
                    ),
                  ]
                : []),
            ],
          );
        }),

        h.path(
          [
            h.D(layout.centerPath),
            h.Fill('var(--card-bg, #12121f)'),
            h.Stroke('var(--card-border, #1e1e33)'),
            h.StrokeWidth('1'),
          ],
          [],
        ),

        ...centerLabel,
      ],
    ),

    // Legend — 2×2 grid below the chart
    ...catArcs.map((cat, i) => {
      const x = i % 2 === 0 ? LEG_X1 : LEG_X2;
      const y = i < 2 ? LEG_Y1 : LEG_Y2;
      const isDimmed = isAnyActive && !cat.childNames.some((cn) => cn === activeValue);
      return h.text(
        [
          h.X(String(x)),
          h.Y(String(y)),
          h.Style({
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '0.6rem',
            'font-weight': '500',
            fill: cat.color,
            opacity: isDimmed ? '0.3' : '1',
            transition: 'opacity 120ms',
            'pointer-events': 'none',
            'user-select': 'none',
          }),
        ],
        [`● ${cat.name}`],
      );
    }),
  ]);
};
