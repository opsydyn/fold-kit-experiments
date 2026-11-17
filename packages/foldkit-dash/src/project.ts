/**
 * A project: `pages/**\/*.md` and `data/`. Reading every page, turning each plot fence
 * into a figure and a description, and collecting every problem, in one pass that
 * `build`, `check` and `describe` share. Synchronous: a build reads and runs things in
 * order, and its output does not depend on timing.
 * @module Project
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

import { describePlot, plotTable } from '@opsydyn/foldkit-viz/plot';
import { plotHtml } from '@opsydyn/foldkit-viz/svg/plot';
import { Result, Schema } from 'effect';

import type { Flags, Section } from './app';
import { type ChartProblem, drawSpec } from './chart';
import { type DataOptions, dataReader } from './data';
import {
  choicesOf,
  defaultsOf,
  type Input,
  readInput,
  referencesIn,
  shown,
  type Values,
} from './inputs';
import {
  bodyOf,
  documentOf,
  type Fence,
  fencesOf,
  type NavEntry,
  outputOf,
  type PageSource,
  sectionsOf,
  titleOf,
} from './page';
import { type Chart, DashInvocationError, type InputEntry, type Problem } from './problems';
import { JsonRecord, type JsonObject, type Rows } from './rows';

/**
 * A page, planned: a static page's whole document, or an interactive page's Flags for
 * its Foldkit app, which the build renders with the page script (`render.ts`).
 */
export type PagePlan =
  | {
      readonly _tag: 'Static';
      readonly file: string;
      readonly output: string;
      readonly title: string;
      readonly html: string;
    }
  | {
      readonly _tag: 'App';
      readonly file: string;
      readonly output: string;
      readonly title: string;
      readonly flags: Flags;
    };

/** Everything one pass over a project finds. */
export type Report = {
  readonly pages: ReadonlyArray<PagePlan>;
  readonly nav: ReadonlyArray<NavEntry>;
  readonly charts: ReadonlyArray<Chart>;
  readonly inputs: ReadonlyArray<InputEntry>;
  readonly problems: ReadonlyArray<Problem>;
  /** How many plot fences the pages hold, drawn or not. */
  readonly chartCount: number;
};

/** A plot fence's JSON: one object, the spec. */
const decodeSpec = Schema.decodeUnknownResult(Schema.fromJsonString(JsonRecord));

const byName = (a: { readonly name: string }, b: { readonly name: string }): number =>
  a.name < b.name ? -1 : 1;

/** Every Markdown file under `folder`, by path from the root, in a stable order. */
function pageFiles(root: string, folder: string): ReadonlyArray<string> {
  return readdirSync(join(root, folder), { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .toSorted(byName)
    .flatMap((entry) => {
      const path = posix.join(folder, entry.name);
      if (entry.isDirectory()) return pageFiles(root, path);
      return entry.name.endsWith('.md') ? [path] : [];
    });
}

/** The project's pages, or why there is no project at `root`. */
export function readPages(
  root: string,
): Result.Result<ReadonlyArray<PageSource>, DashInvocationError> {
  const folder = join(root, 'pages');
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    return Result.fail(
      new DashInvocationError({
        message: `${root} has no pages/ folder: run foldkit-dash new <dir> to start a project`,
      }),
    );
  }
  return Result.succeed(
    pageFiles(root, 'pages').map((file) => ({
      file,
      text: readFileSync(join(root, file), 'utf8'),
    })),
  );
}

/** How many times a chart is compiled to check its inputs' choices, at most. */
const choiceBudget = 200;

/** A fence, located: its page and line. */
type Where = { readonly file: string; readonly line: number };

const at = (where: Where, problem: Omit<Problem, 'file' | 'line'>): Problem => ({
  ...where,
  ...problem,
});

/** A problem drawn where its chart would be, so a page built anyway shows it. */
const problemFigure = (line: number, message: string): string =>
  `<p class="problem" role="note">Chart at line ${line}: ${Bun.escapeHTML(message)}</p>`;

const isText = Schema.is(Schema.String);

/** The data names a spec may read: its `data`, or every choice of the input it names. */
const dataNamesOf = (
  spec: JsonObject,
  inputs: ReadonlyMap<string, Input>,
): ReadonlyArray<string> => {
  const named = spec['data'];
  if (isText(named)) return [named];
  const reference = referencesIn(named ?? null)[0];
  const input = reference === undefined ? undefined : inputs.get(reference);
  if (input?._tag !== 'Choose') return [];
  return input.choices.filter(isText);
};

/** One input fence's outcome: the input, or its problem. */
type ReadInput =
  | { readonly _tag: 'Read'; readonly input: Input }
  | { readonly _tag: 'Unread'; readonly message: string };

/** One plot fence's outcome. */
type ReadChart =
  | {
      readonly _tag: 'Chart';
      readonly spec: JsonObject;
      readonly drawn: Result.Result<
        { readonly figure: string; readonly summary: string },
        ChartProblem
      >;
      readonly at: Values;
    }
  | { readonly _tag: 'Unread'; readonly message: string };

const problemOfChart = (problem: ChartProblem): Omit<Problem, 'file' | 'line'> => ({
  kind: problem.kind,
  path: problem.path,
  message: problem.message,
});

/** Everything one page contributes. */
type PageResult = {
  readonly plan: PagePlan;
  readonly charts: ReadonlyArray<Chart>;
  readonly inputs: ReadonlyArray<InputEntry>;
  readonly problems: ReadonlyArray<Problem>;
};

const entryOf = (where: Where, input: Input): InputEntry => ({
  ...where,
  name: input.name,
  type: input._tag === 'Choose' ? input.style : input._tag === 'Range' ? 'range' : 'checkbox',
  value: input.value,
  choices: choicesOf(input).length,
});

/**
 * Checks a chart at every choice of each input it uses, one input at a time with the
 * others at their defaults, and reports the first choice of each that does not draw.
 */
const checkChoices = (
  where: Where,
  spec: JsonObject,
  data: ReadonlyMap<string, Rows>,
  inputs: ReadonlyMap<string, Input>,
  defaults: Values,
): ReadonlyArray<Problem> => {
  let budget = choiceBudget;
  return referencesIn(spec).flatMap((name) => {
    const input = inputs.get(name);
    if (input === undefined) return [];
    for (const choice of choicesOf(input)) {
      if (budget <= 0 || choice === defaults[name]) continue;
      budget -= 1;
      const result = drawSpec(spec, data, { ...defaults, [name]: choice });
      if (Result.isFailure(result)) {
        const problem = problemOfChart(result.failure);
        return [
          at(where, { ...problem, message: `with ${name} = ${shown(choice)}: ${problem.message}` }),
        ];
      }
    }
    return [];
  });
};

/** Reads, draws and checks one page. */
function analysePage(
  page: PageSource,
  nav: ReadonlyArray<NavEntry>,
  read: ReturnType<typeof dataReader>,
): PageResult {
  const fences: ReadonlyArray<Fence> = fencesOf(page.text);
  const whereOf = (fence: Fence): Where => ({ file: page.file, line: fence.line });
  const readData = (name: string) => Result.mapError(read(name), (problem) => problem.message);
  const problems: Array<Problem> = [];

  // Inputs first: charts refer to them, and may take their data from them.
  const inputs = new Map<string, Input>();
  const readInputs = new Map<Fence, ReadInput>();
  for (const fence of fences.filter((each) => each.kind === 'input')) {
    const result = readInput(fence.source, readData);
    const message = Result.isFailure(result)
      ? result.failure
      : inputs.has(result.success.name)
        ? `name: another input on this page is already called "${result.success.name}"`
        : undefined;
    if (message === undefined && Result.isSuccess(result)) {
      inputs.set(result.success.name, result.success);
      readInputs.set(fence, { _tag: 'Read', input: result.success });
    } else {
      problems.push(at(whereOf(fence), { kind: 'input', path: null, message: message ?? '' }));
      readInputs.set(fence, { _tag: 'Unread', message: message ?? '' });
    }
  }
  const defaults = defaultsOf([...inputs.values()]);

  const data = new Map<string, Rows>();
  const charts: Array<Chart> = [];
  const readCharts = new Map<Fence, ReadChart>();
  for (const fence of fences.filter((each) => each.kind === 'plot')) {
    const where = whereOf(fence);
    const decoded = decodeSpec(fence.source);
    if (Result.isFailure(decoded)) {
      const message = `a plot fence holds one JSON object: ${decoded.failure.message}`;
      problems.push(at(where, { kind: 'json', path: null, message }));
      readCharts.set(fence, { _tag: 'Unread', message });
      continue;
    }
    const spec = decoded.success;
    const unknown = referencesIn(spec).filter((name) => !inputs.has(name));
    if (unknown.length > 0) {
      const message = `refers to no input "${unknown.join('", "')}" on this page`;
      problems.push(at(where, { kind: 'input', path: null, message }));
      readCharts.set(fence, { _tag: 'Unread', message });
      continue;
    }
    const missing = dataNamesOf(spec, inputs).flatMap((name) => {
      const rows = read(name);
      if (Result.isSuccess(rows)) data.set(name, rows.success);
      return Result.isFailure(rows) ? [rows.failure] : [];
    });
    if (missing.length > 0) {
      for (const problem of missing) problems.push(at(where, { ...problem, path: null }));
      readCharts.set(fence, {
        _tag: 'Unread',
        message: missing.map((each) => each.message).join('; '),
      });
      continue;
    }
    const used = Object.fromEntries(
      referencesIn(spec).map((name) => [name, defaults[name] ?? null]),
    );
    const drawn = Result.map(drawSpec(spec, data, defaults), ({ plot, geometry }) => ({
      figure: `<figure class="chart">${plotHtml(geometry, { table: plotTable(plot), summary: true })}</figure>`,
      summary: describePlot(geometry),
    }));
    if (Result.isFailure(drawn)) problems.push(at(where, problemOfChart(drawn.failure)));
    else charts.push({ ...where, summary: drawn.success.summary, at: used });
    problems.push(...checkChoices(where, spec, data, inputs, defaults));
    readCharts.set(fence, { _tag: 'Chart', spec, drawn, at: used });
  }

  const output = outputOf(page.file);
  const title = titleOf(page);
  const entries = [...readInputs].flatMap(([fence, result]) =>
    result._tag === 'Read' ? [entryOf(whereOf(fence), result.input)] : [],
  );
  const result = {
    charts,
    inputs: entries,
    problems: problems.toSorted((a, b) => a.line - b.line),
  };

  if (readInputs.size === 0) {
    const figures = fences.map((fence) => {
      const chart = readCharts.get(fence);
      if (chart?._tag !== 'Chart') return problemFigure(fence.line, chart?.message ?? '');
      return Result.isSuccess(chart.drawn)
        ? chart.drawn.success.figure
        : problemFigure(fence.line, chart.drawn.failure.message);
    });
    const html = documentOf({ title, output, nav, body: bodyOf(page.text, figures) });
    return { ...result, plan: { _tag: 'Static', file: page.file, output, title, html } };
  }

  const sections = sectionsOf(page.text).map((section): Section => {
    if (section._tag === 'Prose') return section;
    const fence = fences[section.index];
    const line = fence?.line ?? 0;
    const input = fence === undefined ? undefined : readInputs.get(fence);
    if (input !== undefined) {
      return input._tag === 'Read'
        ? { _tag: 'Control', input: input.input }
        : { _tag: 'Broken', line, message: input.message };
    }
    const chart = fence === undefined ? undefined : readCharts.get(fence);
    return chart?._tag === 'Chart'
      ? { _tag: 'Chart', line, spec: chart.spec }
      : { _tag: 'Broken', line, message: chart?.message ?? '' };
  });
  const flags: Flags = { title, sections, data: Object.fromEntries(data) };
  return { ...result, plan: { _tag: 'App', file: page.file, output, title, flags } };
}

/** Reads, draws and checks every page of the project at `options.root`. */
export function analyse(options: DataOptions): Result.Result<Report, DashInvocationError> {
  return Result.map(readPages(options.root), (sources) => {
    const read = dataReader(options);
    const nav: ReadonlyArray<NavEntry> = sources.map((page) => ({
      output: outputOf(page.file),
      title: titleOf(page),
    }));
    const results = sources.map((page) => analysePage(page, nav, read));
    return {
      pages: results.map((each) => each.plan),
      nav,
      charts: results.flatMap((each) => each.charts),
      inputs: results.flatMap((each) => each.inputs),
      problems: results.flatMap((each) => each.problems),
      chartCount: sources.reduce(
        (count, page) =>
          count + fencesOf(page.text).filter((fence) => fence.kind === 'plot').length,
        0,
      ),
    };
  });
}
