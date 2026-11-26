import { compilePlot, plotTable } from '@opsydyn/foldkit-viz/plot';
import type { ColumnTable, PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { plotHtml } from '@opsydyn/foldkit-viz/svg/plot';

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

const chart = (spec: PlotSpec): string =>
  `<figure class="chart">${plotHtml(compilePlot(spec), {
    summary: true,
    table: plotTable(spec),
  })}</figure>`;

function costs(report: Report): string {
  const rows = [
    ['Histogram in Polars', report.histogram.bins.length, report.histogram.ms],
    ['Density grid in Polars', report.density.cells.length, report.density.ms],
  ] as const;
  return `<table class="costs">
    <caption>What this request cost the server</caption>
    <thead><tr>
      <th scope="col">Step</th>
      <th scope="col">Rows in</th>
      <th scope="col">Rows out</th>
      <th scope="col">Time</th>
    </tr></thead>
    <tbody>${rows
      .map(
        ([step, rowsOut, duration]) => `<tr>
      <th scope="row">${step}</th>
      <td>${thousands(report.requests)}</td>
      <td>${thousands(rowsOut)}</td>
      <td>${ms(duration)}</td>
    </tr>`,
      )
      .join('')}</tbody>
  </table>`;
}

function controls({ binWidth, maxLatency }: SummaryOptions): string {
  return `<form class="controls" method="get" action="/">
    <label>Bin width (ms) <input name="bin" type="number" min="5" max="1000" value="${binWidth}"></label>
    <label>Latency up to (ms) <input name="max" type="number" min="100" max="20000" value="${maxLatency}"></label>
    <button type="submit">Summarise again</button>
  </form>`;
}

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
export function renderPage(report: Report): string {
  const { binWidth, maxLatency } = report.options;
  return `<!doctype html><html lang="en"><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Polars summary</title><style>${STYLE}</style>
  </head><body><main class="page">
    <h1>Summarise in the engine, plot the summary</h1>
    <p>/explore sends ${thousands(report.requests)} requests to the browser and draws each one.
      This page keeps them in a Polars frame on the server, bins them there on each request,
      and sends only the bins: the same picture from a few hundred rows.</p>
    ${controls(report.options)}
    ${costs(report)}
    ${chart(report.histogram.spec)}
    ${chart(report.density.spec)}
    <p class="note">The histogram spec is plain JSON at
      <a href="/spec.json?bin=${binWidth}&amp;max=${maxLatency}">/spec.json</a>,
      valid under the plot spec schema foldkit-viz publishes: what a Python or Rust service would send.</p>
  </main></body></html>`;
}
