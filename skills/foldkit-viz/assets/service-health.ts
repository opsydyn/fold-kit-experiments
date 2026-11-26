import { marksFor, addMarks } from '@opsydyn/foldkit-viz/effect/plot';
import { compilePlot, plotTables, sharePlotScales } from '@opsydyn/foldkit-viz/plot';
import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { plotHtml } from '@opsydyn/foldkit-viz/svg/plot';

const at = [Date.UTC(2026, 0, 15, 12), Date.UTC(2026, 0, 15, 14)] as const;
const data = [
  { at: at[0], service: 'Checkout', latency: 180, low: 160, high: 205, errorRate: 0.012 },
  { at: at[1], service: 'Checkout', latency: 240, low: 190, high: 270, errorRate: 0.027 },
  { at: at[0], service: 'Search', latency: 120, low: 100, high: 145, errorRate: 0.002 },
  { at: at[1], service: 'Search', latency: 135, low: 115, high: 150, errorRate: 0.005 },
];
const mark = marksFor<(typeof data)[number]>();

const share = sharePlotScales({
  x: { type: 'time', domain: at },
  color: { type: 'categorical', domain: ['Checkout', 'Search'], scheme: 'dark2' },
});
const base = {
  width: 620,
  height: 260,
  data,
  x: { label: 'Time (UTC)', format: { kind: 'dateTime', timeStyle: 'short', locale: 'en-GB' } },
  marks: [],
} satisfies PlotSpec;

export const latency = share(addMarks(
  { mark: 'area', x: 'at', y: 'high', y0: 'low', fill: 'service', z: 'service', opacity: 0.2 },
  mark.line({ x: 'at', y: 'latency', stroke: 'service' }),
  mark.ruleY(250),
)({
  ...base,
  title: 'Service latency',
  description: 'Shading shows the supplied low and high estimates. The rule is the 250 ms objective.',
  y: { label: 'Latency', format: { kind: 'unit', unit: 'millisecond', digits: 0 } },
}));

export const errors = share(addMarks(mark.line({ x: 'at', y: 'errorRate', stroke: 'service' }))({
  ...base,
  title: 'Checkout error rate',
  data: data.filter((row) => row.service === 'Checkout'),
  y: { label: 'Errors', format: { kind: 'percent', digits: 1 } },
}));

/** Each figure has its own y axis and tables. Both figures use the same time extent and colours. */
export function serviceHealthFigures(): ReadonlyArray<string> {
  return [latency, errors].map((spec) => {
    const geometry = compilePlot(spec);
    return plotHtml(geometry, { summary: true, tables: plotTables(spec, geometry) });
  });
}
