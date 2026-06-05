import { tableau10 } from '@opsydyn/foldkit-viz/math/schemes';
import { arc, arcCentroid } from '@opsydyn/foldkit-viz/shape/arc';
import { chord, ribbon } from '@opsydyn/foldkit-viz/shape/chord';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { svgRoot } from '../shared';

// MODEL

export type GroupMeta = Readonly<{ label: string; color?: string }>;

export type InitConfig = Readonly<{
  matrix: ReadonlyArray<ReadonlyArray<number>>;
  groups: ReadonlyArray<GroupMeta>;
  scheme?: ReadonlyArray<string>;
  padAngle?: number;
}>;

// DIMENSIONS

const W = 300;
const H = 300;
const CX = 150;
const CY = 148;
const GROUP_R0 = 110;
const GROUP_R1 = 122;
const RIBBON_R = 108;
const PAD_ANGLE = 0.04;

function tint(hex: string, t: number): string {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

type ComputedGroup = Readonly<{
  index: number;
  label: string;
  color: string;
  pathD: string;
  labelX: number;
  labelY: number;
  labelAnchor: string;
  startAngle: number;
  endAngle: number;
}>;

type ComputedRibbon = Readonly<{
  key: string;
  sourceIndex: number;
  targetIndex: number;
  sourceColor: string;
  targetColor: string;
  fillColor: string;
  pathD: string;
}>;

type Layout = Readonly<{
  groups: ReadonlyArray<ComputedGroup>;
  ribbons: ReadonlyArray<ComputedRibbon>;
}>;

export type Model = Readonly<{
  layout: Layout;
  activeIndex: Option.Option<number>;
}>;

function buildLayout(cfg: InitConfig): Layout {
  const { matrix, groups: groupMeta } = cfg;
  const padAngle = cfg.padAngle ?? PAD_ANGLE;

  const layout = chord(matrix, { padAngle });

  const computedGroups: ComputedGroup[] = layout.groups.map((g) => {
    const scheme = cfg.scheme ?? tableau10;
    const groupEntry = groupMeta[g.index];
    const color = groupEntry?.color ?? scheme[g.index % scheme.length] ?? '#94a3b8';
    const label = groupEntry?.label ?? String(g.index);
    const meta = { label, color };
    const pathD =
      arc({
        startAngle: g.startAngle,
        endAngle: g.endAngle,
        innerRadius: GROUP_R0,
        outerRadius: GROUP_R1,
      }) ?? '';

    // Label placed outside the arc
    const midAngle = (g.startAngle + g.endAngle) / 2;
    const [lx, ly] = arcCentroid({
      startAngle: g.startAngle,
      endAngle: g.endAngle,
      innerRadius: GROUP_R1 + 10,
      outerRadius: GROUP_R1 + 10,
    });

    // Text anchor based on which half of the circle
    const normAngle = ((midAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const labelAnchor =
      normAngle < 0.1 || normAngle > 2 * Math.PI - 0.1
        ? 'middle'
        : normAngle < Math.PI
          ? 'start'
          : 'end';

    return {
      index: g.index,
      label: meta.label,
      color: meta.color,
      pathD,
      labelX: Math.round(lx * 10) / 10,
      labelY: Math.round(ly * 10) / 10,
      labelAnchor,
      startAngle: g.startAngle,
      endAngle: g.endAngle,
    };
  });

  const computedRibbons: ComputedRibbon[] = layout.chords.map((c) => {
    const si = c.source.index;
    const ti = c.target.index;
    const scheme = cfg.scheme ?? tableau10;
    const sMeta = groupMeta[si] ?? { label: '', color: scheme[si % scheme.length] ?? '#94a3b8' };
    const tMeta = groupMeta[ti] ?? { label: '', color: scheme[ti % scheme.length] ?? '#94a3b8' };
    const sColor = sMeta.color ?? scheme[si % scheme.length] ?? '#94a3b8';
    const tColor = tMeta.color ?? scheme[ti % scheme.length] ?? '#94a3b8';
    const pathD = ribbon(c.source, c.target, { radius: RIBBON_R });
    return {
      key: `${si}-${ti}`,
      sourceIndex: si,
      targetIndex: ti,
      sourceColor: sColor,
      targetColor: tColor,
      fillColor: tint(sColor, 0.3),
      pathD,
    };
  });

  return { groups: computedGroups, ribbons: computedRibbons };
}

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [{ layout: buildLayout(cfg), activeIndex: Option.none() }, []];
}

// MESSAGE

export const HoveredGroup = m('HoveredGroup', { index: Schema.Number });
export const BlurredGroup = m('BlurredGroup', {});

export const Message = Schema.Union([HoveredGroup, BlurredGroup]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredGroup: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredGroup: () => [{ ...model, activeIndex: Option.none() }, []],
    }),
  );

// VIEW

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Chord diagram' } = config;
  const { layout, activeIndex } = model;
  const { groups, ribbons } = layout;

  const isAnyActive = Option.isSome(activeIndex);
  const activeIdx = isAnyActive ? activeIndex.value : null;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${CX},${CY})`)],
      [
        // Ribbons
        ...ribbons.map((r) => {
          const isActive =
            isAnyActive && (r.sourceIndex === activeIdx || r.targetIndex === activeIdx);
          const opacity = !isAnyActive ? '0.65' : isActive ? '0.85' : '0.1';
          return h.path(
            [
              h.D(r.pathD),
              h.Fill(isActive ? tint(r.sourceColor, 0.15) : r.fillColor),
              h.Stroke(r.sourceColor),
              h.StrokeWidth(isActive ? '1' : '0.3'),
              h.Style({ opacity, transition: 'opacity 150ms' }),
            ],
            [],
          );
        }),

        // Group arcs
        ...groups.map((g) => {
          const isActive = isAnyActive && g.index === activeIdx;
          const opacity = !isAnyActive ? '1' : isActive ? '1' : '0.4';
          return h.g(
            [
              h.Style({ cursor: 'pointer' }),
              h.OnMouseEnter(toParentMessage(HoveredGroup({ index: g.index }))),
              h.OnMouseLeave(toParentMessage(BlurredGroup({}))),
              h.AriaLabel(g.label),
            ],
            [
              h.path(
                [
                  h.D(g.pathD),
                  h.Fill(g.color),
                  h.Stroke('var(--card-bg, #12121f)'),
                  h.StrokeWidth('1'),
                  h.Style({ opacity, transition: 'opacity 150ms' }),
                ],
                [],
              ),
              h.text(
                [
                  h.X(String(g.labelX)),
                  h.Y(String(g.labelY)),
                  h.Style({
                    'text-anchor': g.labelAnchor,
                    'dominant-baseline': 'middle',
                    'font-size': '0.6rem',
                    'font-weight': isActive ? '700' : '500',
                    fill: isActive ? g.color : '#475569',
                    opacity: !isAnyActive ? '1' : isActive ? '1' : '0.5',
                    transition: 'opacity 150ms',
                    'pointer-events': 'none',
                    'user-select': 'none',
                  }),
                ],
                [g.label],
              ),
            ],
          );
        }),
      ],
    ),
  ]);
};
