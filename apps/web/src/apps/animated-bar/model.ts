import { easeOutCubic, type Tween, tweenCreate } from '@opsydyn/foldkit-viz/math/tween';
import { Option, Schema } from 'effect';

const Bar = Schema.Struct({
  label: Schema.String,
  value: Schema.Number,
  color: Schema.String,
});
type Bar = typeof Bar.Type;

/**
 * A bar's tween as the Model keeps it: data only. The easing function stays out of the
 * Model (DevTools encodes the Model as JSON), and `eased` puts it back to step or read it.
 */
export const BarTween = Schema.Struct({
  progress: Schema.Number,
  duration: Schema.Number,
  elapsed: Schema.Number,
});
export type BarTween = typeof BarTween.Type;

/** Every bar eases out the same way. */
export const eased = (tween: BarTween): Tween => ({ ...tween, ease: easeOutCubic });

/** A stepped tween back as data. */
export const settled = ({ progress, duration, elapsed }: Tween): BarTween => ({
  progress,
  duration,
  elapsed,
});

export const Model = Schema.Struct({
  bars: Schema.Array(Bar),
  tweens: Schema.Array(BarTween),
  activeIndex: Schema.Option(Schema.Number),
});
export type Model = typeof Model.Type;

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

export const init: Model = {
  bars: BARS,
  tweens: BARS.map((_, i) => settled(tweenCreate(DURATION + i * STAGGER, easeOutCubic))),
  activeIndex: Option.none(),
};
