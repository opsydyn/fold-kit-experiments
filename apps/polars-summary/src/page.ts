import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import { compilePlot, plotTable } from '@opsydyn/foldkit-viz/plot';
import type { ColumnTable, PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import type { SummaryOptions } from './summary.js';

/** What one request cost, measured on the server. */
export type Report = Readonly<{
  options: SummaryOptions;
  requests: number;
  histogram: Readonly<{ spec: PlotSpec; bins: ColumnTable; ms: number }>;
  density: Readonly<{ spec: PlotSpec; cells: ColumnTable; ms: number }>;
}>;

const thousands = (n: number): string => n.toLocaleString('en-US');
const ms = (n: number): string => `${n.toFixed(1)} ms`;

const chart = (h: HtmlBuilder<never>, spec: PlotSpec): Html =>
  h.figure(
    [h.Class('chart')],
    [plotChart(h, compilePlot(spec), { summary: true, table: plotTable(spec) })],
  );

const costs = (h: HtmlBuilder<never>, report: Report): Html =>
  h.table(
    [h.Class('costs')],
    [
      h.caption([], ['What this request cost the server']),
      h.thead(
        [],
        [
          h.tr(
            [],
            ['Step', 'Rows in', 'Rows out', 'Time'].map((t) => h.th([h.Scope('col')], [t])),
          ),
        ],
      ),
      h.tbody(
        [],
        [
          [
            'Histogram in Polars',
            report.requests,
            report.histogram.bins.length,
            report.histogram.ms,
          ],
          [
            'Density grid in Polars',
            report.requests,
            report.density.cells.length,
            report.density.ms,
          ],
        ].map(([step, rowsIn, rowsOut, time]) =>
          h.tr(
            [],
            [
              h.th([h.Scope('row')], [String(step)]),
              h.td([], [thousands(Number(rowsIn))]),
              h.td([], [thousands(Number(rowsOut))]),
              h.td([], [ms(Number(time))]),
            ],
          ),
        ),
      ),
    ],
  );

const controls = (h: HtmlBuilder<never>, { binWidth, maxLatency }: SummaryOptions): Html =>
  h.form(
    [h.Class('controls'), h.Method('get'), h.Action('/')],
    [
      h.label(
        [],
        [
          'Bin width (ms) ',
          h.input([
            h.Name('bin'),
            h.Type('number'),
            h.Min('5'),
            h.Max('1000'),
            h.Value(String(binWidth)),
          ]),
        ],
      ),
      h.label(
        [],
        [
          'Latency up to (ms) ',
          h.input([
            h.Name('max'),
            h.Type('number'),
            h.Min('100'),
            h.Max('20000'),
            h.Value(String(maxLatency)),
          ]),
        ],
      ),
      h.button([h.Type('submit')], ['Summarise again']),
    ],
  );

/** The page: the summary pattern, its cost, and the two charts it sends. */
export const pageView = (report: Report, h: HtmlBuilder<never>): Document => ({
  title: 'Polars summary',
  body: h.main(
    [h.Class('page')],
    [
      h.h1([], ['Summarise in the engine, plot the summary']),
      h.p(
        [],
        [
          `/explore sends ${thousands(report.requests)} requests to the browser and draws each one. `,
          'This page keeps them in a Polars frame on the server, bins them there on each request, ',
          'and sends only the bins: the same picture from a few hundred rows.',
        ],
      ),
      controls(h, report.options),
      costs(h, report),
      chart(h, report.histogram.spec),
      chart(h, report.density.spec),
      h.p(
        [h.Class('note')],
        [
          'The histogram spec is plain JSON at ',
          h.a(
            [h.Href(`/spec.json?bin=${report.options.binWidth}&max=${report.options.maxLatency}`)],
            ['/spec.json'],
          ),
          ', valid under the plot spec schema foldkit-viz publishes: what a Python or Rust service would send.',
        ],
      ),
    ],
  ),
});

const STYLE = `
:root { color-scheme: light dark; --ink: #1f2937; --muted: #6b7280; --rule: #e5e7eb; --paper: #ffffff; }
@media (prefers-color-scheme: dark) { :root { --ink: #e5e7eb; --muted: #9ca3af; --rule: #374151; --paper: #111827; } }
body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.5 system-ui, sans-serif; }
.page { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
.controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; margin: 16px 0; }
.controls input { width: 7em; }
.costs { border-collapse: collapse; margin: 16px 0; width: 100%; }
.costs th, .costs td { border-bottom: 1px solid var(--rule); padding: 4px 8px; text-align: right; }
.costs th[scope='row'], .costs caption { text-align: left; }
.costs caption { color: var(--muted); }
.chart { margin: 24px 0; } .chart svg { max-width: 100%; height: auto; }
.plot-data { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.note { color: var(--muted); }
`;

/** The page as an HTML document, rendered on the server with no client script. */
export async function renderPage(report: Report): Promise<string> {
  const rendered = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: report }),
        view: (model: Report, h: HtmlBuilder<never>) => pageView(model, h),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${rendered.title}</title><style>${STYLE}</style></head><body>${rendered.html}</body></html>`;
}
