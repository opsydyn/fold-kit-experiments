import { UiSchema } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { interpolateHsl, interpolateLab, interpolateRgb } from '@opsydyn/foldkit-viz/math/color';
import { Option, Schema } from 'effect';

import { svgRoot } from '../shared';

// MODEL

type Strip = Readonly<{
  label: string;
  sublabel: string;
  interp: (t: number) => string;
}>;

const C0 = '#dc2626'; // vivid red
const C1 = '#2563eb'; // vivid blue
const STOPS = 60;

const STRIPS: ReadonlyArray<Strip> = [
  {
    label: 'RGB',
    sublabel: 'linear channel blend',
    interp: interpolateRgb(C0, C1),
  },
  {
    label: 'HSL',
    sublabel: 'shortest-path hue',
    interp: interpolateHsl(C0, C1),
  },
  {
    label: 'Lab',
    sublabel: 'perceptual (CIELAB)',
    interp: interpolateLab(C0, C1),
  },
];

export const Model = Schema.Struct({ hovered: Schema.Option(Schema.String) });
export type Model = typeof Model.Type;

export const init: Model = { hovered: Option.none() };

export const Message = UiSchema.TaggedEnum({
  HoveredStrip: { label: Schema.String },
  BlurredStrip: {},
});
export type Message = typeof Message.Type;

export const update = (_model: Model, message: Message): Model =>
  Message.match(message, {
    HoveredStrip: ({ label }) => ({ hovered: Option.some(label) }),
    BlurredStrip: () => init,
  });

// VIEW

const W = 440;
const H = 230;
const MT = 16;
const MR = 16;
const ML = 48;
const PW = W - ML - MR;

const STRIP_H = 32;
const STRIP_GAP = 10;
const LABEL_ROW = 18;
const BLOCK_H = STRIP_H + LABEL_ROW + STRIP_GAP;

const stopW = PW / STOPS;

export function view(h: Html.H<Message>, model: Model, ariaLabel: string) {
  const active = Option.getOrNull(model.hovered);
  const strips = STRIPS.map((strip, index) => {
    const isActive = strip.label === active;
    const isInactive = active !== null && !isActive;
    return h
      .el('g')
      .key(strip.label)
      .attrs({ transform: `translate(0,${index * BLOCK_H})`, style: 'cursor:default' })
      .on('mouseenter', Message.HoveredStrip({ label: strip.label }))
      .on('mouseleave', Message.BlurredStrip())
      .children(
        h
          .el('text')
          .attrs({
            x: '-4',
            y: String(STRIP_H / 2),
            'text-anchor': 'end',
            'dominant-baseline': 'middle',
            'font-size': '0.65rem',
            'font-weight': isActive ? '700' : '600',
            fill: isActive ? '#1e293b' : '#475569',
          })
          .children(strip.label),
        h
          .el('g')
          .attrs({ opacity: isInactive ? '0.35' : '1', style: 'transition:opacity 80ms' })
          .children(
            Array.from({ length: STOPS }, (_, index) =>
              h.el('rect').attrs({
                x: (index * stopW).toFixed(1),
                y: '0',
                width: (stopW + 0.5).toFixed(1),
                height: String(STRIP_H),
                fill: strip.interp(index / (STOPS - 1)),
              }),
            ),
          ),
        h
          .el('text')
          .attrs({
            x: String(PW / 2),
            y: String(STRIP_H + 13),
            'text-anchor': 'middle',
            'font-size': '0.57rem',
            fill: isActive ? '#475569' : '#94a3b8',
          })
          .children(strip.sublabel),
      );
  });
  return svgRoot(h, { width: W, height: H, ariaLabel }, [
    h.el('g').attr('transform', `translate(${ML},${MT})`).children(strips),
  ]);
}
