import { interpolateHsl, interpolateLab, interpolateRgb } from '@opsydyn/foldkit-viz/math/color';
import { Option, Schema } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { Return as UpdateReturn } from 'foldkit/update';

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

export type Model = Readonly<{
  hovered: Option.Option<string>;
}>;

export function init(): UpdateReturn<Model, Message> {
  return { model: { hovered: Option.none() } };
}

// MESSAGE

export const Message = defineMessageUnion({
  HoveredStrip: { label: Schema.String },
  BlurredStrip: {},
});
export type Message = typeof Message.Type;

// UPDATE

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    HoveredStrip: ({ label }) => ({ model: { ...model, hovered: Option.some(label) } }),
    BlurredStrip: () => ({ model: { ...model, hovered: Option.none() } }),
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

export function view<M>(
  config: {
    model: Model;
    toParentMessage: (msg: Message) => M;
    ariaLabel?: string;
  },
  h: HtmlBuilder<M>,
): Html {
  const { model, toParentMessage, ariaLabel = 'Color space interpolation comparison' } = config;
  const { hovered } = model;

  const active = Option.isSome(hovered) ? hovered.value : null;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      STRIPS.map((strip, si) => {
        const ty = si * BLOCK_H;
        const isActive = strip.label === active;
        const isInactive = active !== null && !isActive;

        return h.g(
          [
            h.Transform(`translate(0,${ty})`),
            h.OnMouseEnter(toParentMessage(Message.HoveredStrip({ label: strip.label }))),
            h.OnMouseLeave(toParentMessage(Message.BlurredStrip())),
            h.Style({ cursor: 'default' }),
          ],
          [
            // Strip label
            h.text(
              [
                h.X('-4'),
                h.Y(String(STRIP_H / 2)),
                h.Style({
                  'text-anchor': 'end',
                  'dominant-baseline': 'middle',
                  'font-size': '0.65rem',
                  'font-weight': isActive ? '700' : '600',
                  fill: isActive ? '#1e293b' : '#475569',
                }),
              ],
              [strip.label],
            ),

            // Colour stops
            h.g(
              [h.Opacity(isInactive ? '0.35' : '1'), h.Style({ transition: 'opacity 80ms' })],
              Array.from({ length: STOPS }, (_, i) => {
                const t = i / (STOPS - 1);
                return h.rect(
                  [
                    h.X(String((i * stopW).toFixed(1))),
                    h.Y('0'),
                    h.Width(String((stopW + 0.5).toFixed(1))),
                    h.Height(String(STRIP_H)),
                    h.Fill(strip.interp(t)),
                  ],
                  [],
                );
              }),
            ),

            // Sub-label
            h.text(
              [
                h.X(String(PW / 2)),
                h.Y(String(STRIP_H + 13)),
                h.Style({
                  'text-anchor': 'middle',
                  'font-size': '0.57rem',
                  fill: isActive ? '#475569' : '#94a3b8',
                }),
              ],
              [strip.sublabel],
            ),
          ],
        );
      }),
    ),
  ]);
}
