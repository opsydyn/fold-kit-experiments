import { addMarks, compileChecked, decodePlot, marksFor, type PlotIssue } from '@opsydyn/foldkit-viz/effect/plot';
import { plotChart } from '@opsydyn/foldkit-viz/effect-ui/plot';
import { plotTable } from '@opsydyn/foldkit-viz/plot';
import type { PlotGeometry, PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { Effect, Result } from 'effect';
import type { Html } from '@effect/ui/html';

const readings = [
  { minute: 0, latencyMs: 140 },
  { minute: 1, latencyMs: 260 },
];
const mark = marksFor<(typeof readings)[number]>();
const latency = mark.line({ x: 'minute', y: 'latencyMs' });
const objective = mark.ruleY(250);
const frame = {
  width: 440,
  height: 260,
  data: readings,
  title: 'Service latency and 250 ms objective',
  x: { label: 'Minute' },
  y: { label: 'Latency (ms)' },
  marks: [],
} satisfies PlotSpec;

export const latencyPlot = addMarks(latency, objective)(frame);

/** Call inside the Effect UI command that loads and validates the next chart. */
export const preparePlot = (input: unknown) =>
  Effect.fromResult(Result.flatMap(decodePlot(input), compileChecked));

type ChartState = {
  readonly geometry: PlotGeometry | null;
  readonly issue: PlotIssue | null;
};

/** Apply a matching command result. An invalid refresh preserves the previous chart. */
export const finishRefresh = (
  current: ChartState,
  result: Result.Result<PlotGeometry, PlotIssue>,
): ChartState =>
  Result.match(result, {
    onFailure: (issue) => ({ ...current, issue }),
    onSuccess: (geometry) => ({ geometry, issue: null }),
  });

/** Pass the application's builder. The host owns the displayed error and prior chart. */
export function latencyView<Message>(h: Html.H<Message>) {
  return Result.match(compileChecked(latencyPlot), {
    onFailure: (issue) => h.p.attr('role', 'alert').children(issue.message),
    onSuccess: (geometry) =>
      plotChart(h, geometry, { summary: true, table: plotTable(latencyPlot) }),
  });
}
