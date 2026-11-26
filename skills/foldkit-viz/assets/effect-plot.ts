import { addMarks, compileChecked, decodePlot, marksFor, type PlotIssue } from '@opsydyn/foldkit-viz/effect/plot';
import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import { plotTable } from '@opsydyn/foldkit-viz/plot';
import type { PlotGeometry, PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { Effect, Result } from 'effect';
import { revalidateOrLoad, settle } from 'foldkit/asyncData';
import type { AsyncData } from 'foldkit/asyncData';
import type { Html, HtmlBuilder } from 'foldkit/html';

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

/** Call inside the FoldKit command that loads and validates the next chart. */
export const preparePlot = (input: unknown) =>
  Effect.fromResult(Result.flatMap(decodePlot(input), compileChecked));

/** Keep the current chart in the Model while the refresh command runs. */
export const beginRefresh = revalidateOrLoad<PlotGeometry, PlotIssue>;

/** Call from the command's settled message handler. Failure keeps the prior geometry as Stale. */
export const finishRefresh = (
  current: AsyncData<PlotGeometry, PlotIssue>,
  result: Result.Result<PlotGeometry, PlotIssue>,
) => settle(current, result);

/** Pass the application's builder. The host owns the displayed error and prior chart. */
export function latencyView<Message>(h: HtmlBuilder<Message>): Html {
  return Result.match(compileChecked(latencyPlot), {
    onFailure: (issue) => h.p([h.Role('alert')], [issue.message]),
    onSuccess: (geometry) =>
      plotChart(h, geometry, { summary: true, table: plotTable(latencyPlot) }),
  });
}
