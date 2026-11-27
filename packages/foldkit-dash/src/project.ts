/**
 * A project: `pages/**\/*.md` and `data/`. Reading every page, turning each plot fence
 * into a figure and a description, and collecting every problem, in one pass that
 * `build`, `check` and `describe` share. Synchronous: a build reads and runs things in
 * order, and its output does not depend on timing.
 * @module Project
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

import { describePlot, plotTables } from '@opsydyn/foldkit-viz/plot';
import { plotHtml, plotSvg } from '@opsydyn/foldkit-viz/svg/plot';
import { Result, Schema } from 'effect';
import { defaultTreeAdapter, parseFragment, type DefaultTreeAdapterTypes } from 'parse5';

import type { Flags, Section } from './app';
import { type ChartProblem, drawSpec, type Selects, type Series } from './chart';
import { type DataOptions, dataReader } from './data';
import {
  choicesOf,
  defaultsOf,
  type Input,
  type InputValue,
  readInput,
  referencesIn,
  shown,
  valueFor,
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
import type { ProseNode } from './prose';
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
  /** `--at` values this page's inputs cannot take: the command's mistake, not the page's. */
  readonly refused: ReadonlyArray<string>;
};

const entryOf = (where: Where, input: Input): InputEntry => ({
  ...where,
  name: input.name,
  type:
    input._tag === 'Choose'
      ? input.style
      : input._tag === 'Pick'
        ? 'checkboxes'
        : input._tag === 'Between'
          ? 'between'
          : input._tag === 'Range'
            ? 'range'
            : 'checkbox',
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

/** Input values asked for by name (`describe --at name=value`), as text. */
export type AskedValues = ReadonlyMap<string, string>;

/**
 * Why a chart cannot set the input it names when a reader clicks it, or `null`: the
 * input must be a select or radio on the page, with every category the chart shows as
 * one of its choices.
 */
const selectProblem = (selects: Selects, inputs: ReadonlyMap<string, Input>): string | null => {
  const input = inputs.get(selects.input);
  if (input === undefined) return `select: no input "${selects.input}" on this page`;
  if (input._tag !== 'Choose') {
    return `select: "${selects.input}" is not a select or radio, so a click cannot choose it`;
  }
  const choices = new Set(input.choices.map(String));
  const missing = selects.categories.filter((category) => !choices.has(category));
  return missing.length === 0
    ? null
    : `select: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not ${missing.length === 1 ? 'a choice' : 'choices'} of "${selects.input}"`;
};

/**
 * Why a drag across a chart cannot set the input it names, or `null` (ADR 0119): the
 * input must be a `between` input on the page, of dates on a time axis and of numbers on
 * a linear one.
 */
const brushProblem = (
  name: string,
  xType: string | null,
  inputs: ReadonlyMap<string, Input>,
): string | null => {
  const input = inputs.get(name);
  if (input === undefined) return `brush: no input "${name}" on this page`;
  if (input._tag !== 'Between') return `brush: "${name}" is not a between input`;
  const wanted = xType === 'time' ? 'date' : 'number';
  return input.kind === wanted
    ? null
    : `brush: "${name}" holds ${input.kind}s, but the chart's x axis is of ${wanted}s`;
};

/** Reads, draws and checks one page. */
function analysePage(
  page: PageSource,
  nav: ReadonlyArray<NavEntry>,
  read: ReturnType<typeof dataReader>,
  asked: AskedValues,
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
  // Charts are described at the values asked for, where this page has those inputs;
  // checks and the built page keep the defaults.
  const overrides = new Map<string, InputValue>();
  const refused: Array<string> = [];
  for (const [name, text] of asked) {
    const input = inputs.get(name);
    if (input === undefined) continue;
    const value = valueFor(input, text);
    // A value the input cannot take is the command's mistake, as a misspelt name is.
    if (Result.isSuccess(value)) overrides.set(name, value.success);
    else refused.push(`--at ${name}=${text}: ${value.failure}`);
  }

  const shownAt = { ...defaults, ...Object.fromEntries(overrides) };

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
      referencesIn(spec).map((name) => [name, shownAt[name] ?? null]),
    );
    const drawn = Result.map(
      drawSpec(spec, data, shownAt),
      ({ plot, geometry, series, selects, brushes }) => ({
        figure: `<figure class="chart">${plotHtml(geometry, { tables: plotTables(plot, geometry), summary: true })}</figure>`,
        summary: describePlot(geometry),
        series,
        selects,
        brushes,
        xType: geometry.facets[0]?.x?.type ?? null,
      }),
    );
    if (Result.isFailure(drawn)) problems.push(at(where, problemOfChart(drawn.failure)));
    else {
      const { selects } = drawn.success;
      const wrong = selects === null ? null : selectProblem(selects, inputs);
      if (wrong !== null)
        problems.push(at(where, { kind: 'input', path: 'select', message: wrong }));
      const { brushes, xType } = drawn.success;
      const unbrushable = brushes === null ? null : brushProblem(brushes, xType, inputs);
      if (unbrushable !== null) {
        problems.push(at(where, { kind: 'input', path: 'brush', message: unbrushable }));
      }
      charts.push({
        ...where,
        summary: drawn.success.summary,
        at: used,
        series: drawn.success.series,
        selects: selects?.input ?? null,
        brushes: drawn.success.brushes,
      });
    }
    problems.push(...checkChoices(where, spec, data, inputs, defaults));
    readCharts.set(fence, { _tag: 'Chart', spec, drawn, at: used });
  }

  const output = outputOf(page.file);
  const title = titleOf(page);
  const entries = [...readInputs].flatMap(([fence, result]) =>
    result._tag === 'Read' ? [entryOf(whereOf(fence), result.input)] : [],
  );
  const result = {
    refused,
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
    if (section._tag === 'Prose')
      return { _tag: 'Prose', nodes: proseNodes(parseFragment(section.html).childNodes) };
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

/** Convert the Bun renderer's already escaped Markdown into HTML view data. */
function proseNodes(nodes: readonly DefaultTreeAdapterTypes.ChildNode[]): readonly ProseNode[] {
  const result: ProseNode[] = [];
  for (const node of nodes) {
    if (defaultTreeAdapter.isTextNode(node)) result.push(node.value);
    else if (defaultTreeAdapter.isElementNode(node))
      result.push({
        tag: node.tagName,
        attributes: Object.fromEntries(node.attrs.map(({ name, value }) => [name, value])),
        children: proseNodes(node.childNodes),
      });
  }
  return result;
}

/** Reads, draws and checks every page of the project at `options.root`. */
export function analyse(
  options: DataOptions,
  asked: AskedValues = new Map(),
): Result.Result<Report, DashInvocationError> {
  return Result.flatMap(readPages(options.root), (sources) => {
    // An input asked for by name must be on some page: a misspelt name is the command's
    // mistake, not the project's.
    const names = new Set(
      sources.flatMap((page) =>
        fencesOf(page.text).flatMap((fence) => {
          if (fence.kind !== 'input') return [];
          const name = /"name"\s*:\s*"([^"]+)"/.exec(fence.source)?.[1];
          return name === undefined ? [] : [name];
        }),
      ),
    );
    const unknown = [...asked.keys()].filter((name) => !names.has(name));
    if (unknown.length > 0) {
      return Result.fail(
        new DashInvocationError({
          message: `--at ${unknown.join(', ')}: no page has an input of that name`,
        }),
      );
    }
    const read = dataReader(options);
    const nav: ReadonlyArray<NavEntry> = sources.map((page) => ({
      output: outputOf(page.file),
      title: titleOf(page),
    }));
    const results = sources.map((page) => analysePage(page, nav, read, asked));
    const refused = [...new Set(results.flatMap((each) => each.refused))];
    if (refused.length > 0) {
      return Result.fail(new DashInvocationError({ message: refused.join('; ') }));
    }
    return Result.succeed({
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
    });
  });
}

/** One chart drawn on its own: a standalone SVG, what it shows, and its values. */
export type Preview = {
  readonly svg: string;
  readonly summary: string;
  readonly series: ReadonlyArray<Series>;
  readonly at: Values;
};

/**
 * The chart whose fence opens on `line` of `file`, drawn as a standalone SVG at its
 * inputs' defaults, or at the values `asked` names; or why it cannot be.
 */
export function previewChart(
  options: DataOptions,
  file: string,
  line: number,
  asked: AskedValues = new Map(),
): Result.Result<Preview, string> {
  const pages = readPages(options.root);
  if (Result.isFailure(pages)) return Result.fail(pages.failure.message);
  const page = pages.success.find((each) => each.file === file);
  if (page === undefined) {
    return Result.fail(
      `${file} is not a page (pages: ${pages.success.map((each) => each.file).join(', ')})`,
    );
  }
  const read = dataReader(options);
  const readData = (name: string) => Result.mapError(read(name), (problem) => problem.message);
  const fences = fencesOf(page.text);
  const inputs = new Map<string, Input>();
  for (const fence of fences.filter((each) => each.kind === 'input')) {
    const input = readInput(fence.source, readData);
    if (Result.isSuccess(input)) inputs.set(input.success.name, input.success);
  }
  const overrides = new Map<string, InputValue>();
  for (const [name, text] of asked) {
    const input = inputs.get(name);
    if (input === undefined) return Result.fail(`${file} has no input named ${name}`);
    const value = valueFor(input, text);
    if (Result.isFailure(value)) return Result.fail(`${name}=${text}: ${value.failure}`);
    overrides.set(name, value.success);
  }
  const values = { ...defaultsOf([...inputs.values()]), ...Object.fromEntries(overrides) };
  const fence = fences.find((each) => each.kind === 'plot' && each.line === line);
  if (fence === undefined) {
    const lines = fences.filter((each) => each.kind === 'plot').map((each) => each.line);
    return Result.fail(
      `no chart opens on ${file}:${line} (charts open on lines ${lines.join(', ')})`,
    );
  }
  const spec = decodeSpec(fence.source);
  if (Result.isFailure(spec))
    return Result.fail(`a plot fence holds one JSON object: ${spec.failure.message}`);
  const data = new Map<string, Rows>();
  for (const name of dataNamesOf(spec.success, inputs)) {
    const rows = read(name);
    if (Result.isFailure(rows)) return Result.fail(rows.failure.message);
    data.set(name, rows.success);
  }
  const at = Object.fromEntries(
    referencesIn(spec.success).map((name) => [name, values[name] ?? null]),
  );
  return Result.mapBoth(drawSpec(spec.success, data, values), {
    onFailure: (problem) => problem.message,
    onSuccess: ({ geometry, series }) => ({
      svg: plotSvg(geometry),
      summary: describePlot(geometry),
      series,
      at,
    }),
  });
}
