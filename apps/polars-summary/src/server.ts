import type pl from 'nodejs-polars';

import { renderPage } from './page.js';
import type { Report } from './page.js';
import { requestFrame } from './requests.js';
import {
  DEFAULT_OPTIONS,
  densityGrid,
  densitySpec,
  histogramSpec,
  latencyHistogram,
} from './summary.js';
import type { SummaryOptions } from './summary.js';

/**
 * A Bun server with one route that summarises in Polars on every request.
 *
 *   GET /           the page: both charts, rendered on the server
 *   GET /spec.json  the histogram spec as JSON, as another service would send it
 *
 * Both take ?bin= (latency bin width, ms) and ?max= (latency cap, ms).
 */

const LIMITS = {
  bin: { min: 5, max: 1_000, fallback: DEFAULT_OPTIONS.binWidth },
  max: { min: 100, max: 20_000, fallback: DEFAULT_OPTIONS.maxLatency },
} as const;

/** A whole-number query parameter within its limits, its default when absent, or an error. */
function parameter(url: URL, name: keyof typeof LIMITS): number | string {
  const { min, max, fallback } = LIMITS[name];
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max
    ? value
    : `${name} must be a whole number from ${min} to ${max}`;
}

/** The summary options a request asks for, or why they are not acceptable. */
export function optionsFrom(url: URL): SummaryOptions | string {
  const binWidth = parameter(url, 'bin');
  const maxLatency = parameter(url, 'max');
  if (typeof binWidth === 'string') return binWidth;
  if (typeof maxLatency === 'string') return maxLatency;
  return { binWidth, maxLatency };
}

const timed = <A>(run: () => A): readonly [A, number] => {
  const start = performance.now();
  const result = run();
  return [result, performance.now() - start];
};

/** Both summaries for a request, each with its time in Polars. */
export function summarise(frame: pl.DataFrame, options: SummaryOptions): Report {
  const [bins, histogramMs] = timed(() => latencyHistogram(frame, options));
  const [cells, densityMs] = timed(() => densityGrid(frame, options));
  return {
    options,
    requests: frame.height,
    histogram: { spec: histogramSpec(bins, options), bins, ms: histogramMs },
    density: { spec: densitySpec(cells, options), cells, ms: densityMs },
  };
}

/** Answers one request against the frame. */
export async function handle(request: Request, frame: pl.DataFrame): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== '/' && url.pathname !== '/spec.json')
    return new Response('Not found', { status: 404 });
  const options = optionsFrom(url);
  if (typeof options === 'string') return new Response(options, { status: 400 });
  const report = summarise(frame, options);
  if (url.pathname === '/spec.json') return Response.json(report.histogram.spec);
  return new Response(await renderPage(report), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

if (import.meta.main) {
  const frame = requestFrame();
  const server = Bun.serve({
    port: Number(process.env.PORT ?? 4330),
    fetch: (request) => handle(request, frame),
  });
  console.log(`Polars summary: ${server.url} (${frame.height.toLocaleString('en-US')} requests)`);
}
