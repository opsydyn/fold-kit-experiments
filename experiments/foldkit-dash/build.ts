// Spike (docs/assessments/2026-11-16-foldkit-static-dashboards.md): an Observable
// Framework-style static dashboard from foldkit-viz alone.
//
// - Pages are markdown in `pages/`, rendered by Bun's built-in `Bun.markdown`.
// - A ```plot fence holds a foldkit-viz plot spec as JSON (the grammar of marks, ADR 0037);
//   `"data": "name.json"` names a data file or a loader's output.
// - A data loader is `data/name.json.ts`: run at build time, its stdout is `name.json`,
//   cached in `node_modules/.cache/foldkit-dash/` (ignored by git) until the loader changes.
// - Each fence becomes a static figure (`plotHtml`: SVG, legend, summary and data table).
//
//   bun build.ts           # writes dist/
//   bun build.ts --check   # writes nothing; reports problems as JSON, exit 1 if any
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { Result, Schema } from 'effect';

// The workspace's build of foldkit-viz (`bun run --filter @opsydyn/foldkit-viz build`).
import { compilePlot, type PlotSpec, plotTable } from '../../packages/foldkit-viz/dist/plot.mjs';
import { plotHtml } from '../../packages/foldkit-viz/dist/svg/plot.mjs';

const root = import.meta.dir;
const checkOnly = process.argv.includes('--check');
const cache = join(root, 'node_modules', '.cache', 'foldkit-dash');

/** What a data file or loader holds: rows of plain values. */
const Rows = Schema.fromJsonString(
  Schema.Array(
    Schema.Record(
      Schema.String,
      Schema.Union([Schema.Number, Schema.String, Schema.Boolean, Schema.Null]),
    ),
  ),
);
type Rows = typeof Rows.Type;

/** A fence's spec: a JSON object, its `data` either rows or the name of a data file. */
const Fence = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));
type Fence = typeof Fence.Type;

type Problem = { readonly file: string; readonly line: number; readonly message: string };
const problems: Array<Problem> = [];

const decodeRows = (text: string, name: string): Result.Result<Rows, string> =>
  Result.mapError(Schema.decodeUnknownResult(Rows)(text), (error) => `${name}: ${error.message}`);

/** A loader's output: run again when the loader is newer than its cache. */
function loaderOutput(name: string, loader: string): Result.Result<string, string> {
  const cached = join(cache, name);
  if (existsSync(cached) && statSync(cached).mtimeMs >= statSync(loader).mtimeMs) {
    return Result.succeed(readFileSync(cached, 'utf8'));
  }
  const run = Bun.spawnSync(['bun', loader], { stderr: 'pipe' });
  if (run.exitCode !== 0) return Result.fail(`loader ${name}.ts failed: ${run.stderr}`);
  mkdirSync(cache, { recursive: true });
  writeFileSync(cached, run.stdout);
  return Result.succeed(run.stdout.toString());
}

/** A data file's rows, or a loader's. */
function load(name: string): Result.Result<Rows, string> {
  const loader = join(root, 'data', `${name}.ts`);
  const file = join(root, 'data', name);
  if (existsSync(loader))
    return Result.flatMap(loaderOutput(name, loader), (text) => decodeRows(text, name));
  if (existsSync(file)) return decodeRows(readFileSync(file, 'utf8'), name);
  return Result.fail(`no data file or loader for "${name}"`);
}

/** The fence's spec with its named data loaded. */
function withData(fence: Fence): Result.Result<Fence, string> {
  const named = fence['data'];
  if (!Schema.is(Schema.String)(named)) return Result.succeed(fence);
  return Result.map(load(named), (data) => ({ ...fence, data }));
}

/** A spec drawn as a figure; `compilePlot` names any problem by its path in the spec. */
const drawn = (fence: Fence): Result.Result<string, string> =>
  Result.try({
    try: () => {
      // SAFETY: compilePlot checks the spec itself and throws naming the path at fault,
      // which the Result keeps; the spike leaves validation to it.
      const spec = fence as PlotSpec;
      return plotHtml(compilePlot(spec), { table: plotTable(spec), summary: true });
    },
    catch: (error) => String(error).replace(/^\w*Error: /, ''),
  });

/** A plot fence as a figure, or its problem, noted with where it is. */
function figure(source: string, file: string, line: number): string {
  const spec = Result.mapError(Schema.decodeUnknownResult(Fence)(source), (error) => error.message);
  const html = Result.flatMap(Result.flatMap(spec, withData), drawn);
  if (Result.isSuccess(html)) return `<figure class="chart">${html.success}</figure>`;
  problems.push({ file, line, message: html.failure });
  return `<p class="problem">${Bun.escapeHTML(html.failure)}</p>`;
}

const plotFence = /^```plot\n([\s\S]*?)^```$/gm;

/** The line of `text` at `offset`, counting from 1. */
const lineAt = (text: string, offset: number): number => text.slice(0, offset).split('\n').length;

/** A page: plot fences drawn, the rest rendered as markdown around them. */
function render(text: string, file: string): string {
  const figures = [...text.matchAll(plotFence)].map((match) =>
    figure(match[1] ?? '', file, lineAt(text, match.index)),
  );
  const marked = text.replace(plotFence, () => `\n<!--figure-->\n`);
  const parts = Bun.markdown.html(marked, { tagFilter: true }).split('<!--figure-->');
  return parts.map((part, i) => `${part}${figures[i] ?? ''}`).join('');
}

const page = (title: string, body: string): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${Bun.escapeHTML(title)}</title><style>
body { font: 16px/1.5 system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 16px; }
.chart { margin: 1.5rem 0; } .chart svg { max-width: 100%; height: auto; } .problem { color: #b00020; }
</style></head><body>${body}</body></html>`;

const started = performance.now();
const pages = readdirSync(join(root, 'pages')).filter((name) => name.endsWith('.md'));
if (!checkOnly) mkdirSync(join(root, 'dist'), { recursive: true });
for (const name of pages) {
  const text = readFileSync(join(root, 'pages', name), 'utf8');
  const title = /^#\s+(.+)$/m.exec(text)?.[1] ?? basename(name, '.md');
  const html = page(title, render(text, `pages/${name}`));
  if (!checkOnly) writeFileSync(join(root, 'dist', name.replace(/\.md$/, '.html')), html);
}
const ms = (performance.now() - started).toFixed(0);
if (checkOnly) console.log(JSON.stringify({ problems }, null, 2));
else console.error(`${pages.length} pages in ${ms} ms, ${problems.length} problems`);
process.exit(problems.length === 0 ? 0 : 1);
