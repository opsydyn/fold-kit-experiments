import { type Tween, tweenCreate } from '@opsydyn/foldkit-viz/math/tween';
import { Option, Schema } from 'effect';

export type Bar = Readonly<{ label: string; value: number; color: string }>;

export const Model = Schema.Struct({
  bars: Schema.Unknown,
  tweens: Schema.Unknown,
  activeIndex: Schema.Unknown,
});
export type Model = {
  readonly bars: ReadonlyArray<Bar>;
  /** One tween per bar — staggered entry animation */
  readonly tweens: ReadonlyArray<Tween>;
  readonly activeIndex: Option.Option<number>;
};

const BARS: ReadonlyArray<Bar> = [
  { label: 'Q1', value: 42, color: '#6366f1' },
  { label: 'Q2', value: 78, color: '#8b5cf6' },
  { label: 'Q3', value: 55, color: '#a855f7' },
  { label: 'Q4', value: 91, color: '#c026d3' },
  { label: 'Q5', value: 34, color: '#e879f9' },
  { label: 'Q6', value: 67, color: '#7c3aed' },
];

const DURATION = 600; // ms per bar
const STAGGER = 80; // ms delay added per bar index

export function init(_props: unknown): readonly [Model, readonly []] {
  return [
    {
      bars: BARS,
      tweens: BARS.map((_, i) => tweenCreate(DURATION + i * STAGGER)),
      activeIndex: Option.none(),
    },
    [],
  ];
}
