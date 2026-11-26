import { fail } from './channels.js';
import type { ColorScaleSpec, PlotSpec, PositionScaleSpec } from './types.js';

const positionProperties = [
  'type',
  'domain',
  'zero',
  'base',
  'constant',
  'exponent',
  'padding',
  'zone',
] as const;
const colorProperties = ['type', 'domain', 'scheme', 'range'] as const;

type SharedScale<Scale, Keys extends keyof Scale> = Pick<Scale, Keys> &
  Required<Pick<Scale, Extract<Keys, 'type' | 'domain'>>>;

type SharedPositionScale = SharedScale<PositionScaleSpec, (typeof positionProperties)[number]>;

export type SharedPlotScales = Readonly<{
  x?: SharedPositionScale;
  y?: SharedPositionScale;
  color?: SharedScale<ColorScaleSpec, (typeof colorProperties)[number]>;
}>;

const sameValue = <A>(a: A, b: A): boolean =>
  a === b ||
  (Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((value, i) => value === b[i]));

function applyScale<Scale extends object>(
  axis: 'x' | 'y' | 'color',
  local: Scale,
  shared: Partial<Scale>,
  properties: ReadonlyArray<keyof Scale & string>,
): Scale {
  const applied = { ...local };
  for (const property of properties) {
    const value = local[property];
    const sharedValue = shared[property];
    if (value !== undefined && !sameValue(value, sharedValue))
      fail(`${axis}.${property}`, 'conflicts with the shared scale');
    if (sharedValue !== undefined) applied[property] = sharedValue;
  }
  return applied;
}

/** Apply explicit scales to independent plots. A conflicting local setting reports its spec path. */
export const sharePlotScales =
  (scales: SharedPlotScales) =>
  (spec: PlotSpec): PlotSpec => {
    const view = { ...spec };
    if (scales.x !== undefined)
      view.x = applyScale('x', spec.x ?? {}, scales.x, positionProperties);
    if (scales.y !== undefined)
      view.y = applyScale('y', spec.y ?? {}, scales.y, positionProperties);
    if (scales.color !== undefined)
      view.color = applyScale('color', spec.color ?? {}, scales.color, colorProperties);
    return view;
  };
