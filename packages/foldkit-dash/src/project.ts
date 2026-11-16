/**
 * A project: `pages/**\/*.md` and `data/`. Reading every page, turning each plot fence
 * into a figure and a description, and collecting every problem, in one pass that
 * `build`, `check` and `describe` share. Synchronous: a build reads and runs things in
 * order, and its output does not depend on timing.
 * @module Project
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

import { compilePlot, describePlot, type PlotSpec, plotTable } from '@opsydyn/foldkit-viz/plot';
import { plotHtml } from '@opsydyn/foldkit-viz/svg/plot';
import { Result, Schema } from 'effect';

import { type DataOptions, type DataProblem, dataReader, type Rows } from './data';
import {
  bodyOf,
  documentOf,
  type Fence,
  fencesOf,
  type NavEntry,
  outputOf,
  type PageSource,
  titleOf,
} from './page';
import { type Chart, DashInvocationError, type Problem, specPathOf } from './problems';

/** A page as built: where it goes, its title and its whole document. */
export type BuiltPage = {
  readonly file: string;
  readonly output: string;
  readonly title: string;
  readonly html: string;
};

/** Everything one pass over a project finds. */
export type Report = {
  readonly pages: ReadonlyArray<BuiltPage>;
  readonly charts: ReadonlyArray<Chart>;
  readonly problems: ReadonlyArray<Problem>;
};

/** A fence's JSON: one object, the spec. */
const FenceObject = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));
type FenceObject = typeof FenceObject.Type;

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

/** One fence: its figure and description, or its problem. */
type Drawn =
  | { readonly _tag: 'Drawn'; readonly figure: string; readonly summary: string }
  | { readonly _tag: 'Failed'; readonly problem: Omit<Problem, 'file' | 'line'> };

/** A fence that did not draw, and why. */
const failed = (kind: Problem['kind'], message: string, path: string | null = null): Drawn => ({
  _tag: 'Failed',
  problem: { kind, path, message },
});

/** A fence's spec with its named data loaded in. Inline rows pass through as written. */
function withData(
  spec: FenceObject,
  read: (name: string) => Result.Result<Rows, DataProblem>,
): Result.Result<FenceObject, Drawn> {
  const named = spec['data'];
  if (!Schema.is(Schema.String)(named)) return Result.succeed(spec);
  return Result.mapBoth(read(named), {
    onFailure: (problem) => failed(problem.kind, problem.message),
    onSuccess: (data) => ({ ...spec, data }),
  });
}

/** A spec drawn, or what `compilePlot` said was wrong with it, path first. */
function drawn(spec: FenceObject): Drawn {
  const compiled = Result.try({
    try: () => {
      // SAFETY: compilePlot validates the whole spec and throws a RangeError naming the
      // path at fault, which becomes a `spec` problem; nothing reads the spec unchecked.
      const plot = spec as PlotSpec;
      return { plot, geometry: compilePlot(plot) };
    },
    catch: (error) => (error instanceof Error ? error.message : String(error)),
  });
  if (Result.isFailure(compiled)) {
    return failed('spec', compiled.failure, specPathOf(compiled.failure));
  }
  const { plot, geometry } = compiled.success;
  const figure = plotHtml(geometry, { table: plotTable(plot), summary: true });
  return {
    _tag: 'Drawn',
    figure: `<figure class="chart">${figure}</figure>`,
    summary: describePlot(geometry),
  };
}

/** One fence, all the way: its JSON, its data, its chart. */
function draw(fence: Fence, read: (name: string) => Result.Result<Rows, DataProblem>): Drawn {
  const spec = Schema.decodeUnknownResult(FenceObject)(fence.source);
  if (Result.isFailure(spec)) {
    return failed('json', `a plot fence holds one JSON object: ${spec.failure.message}`);
  }
  const loaded = withData(spec.success, read);
  return Result.isFailure(loaded) ? loaded.failure : drawn(loaded.success);
}

/** A problem drawn where its chart would be, so a page built anyway shows it. */
const problemFigure = (line: number, message: string): string =>
  `<p class="problem" role="note">Chart at line ${line}: ${Bun.escapeHTML(message)}</p>`;

/** A fence on a page, drawn. */
type Located = { readonly file: string; readonly line: number; readonly drawn: Drawn };

const problemOf = ({ file, line, drawn: result }: Located): ReadonlyArray<Problem> =>
  result._tag === 'Failed' ? [{ file, line, ...result.problem }] : [];

const chartOf = ({ file, line, drawn: result }: Located): ReadonlyArray<Chart> =>
  result._tag === 'Drawn' ? [{ file, line, summary: result.summary }] : [];

const figureOf = ({ line, drawn: result }: Located): string =>
  result._tag === 'Drawn' ? result.figure : problemFigure(line, result.problem.message);

/** Reads, draws and checks every page of the project at `options.root`. */
export function analyse(options: DataOptions): Result.Result<Report, DashInvocationError> {
  return Result.map(readPages(options.root), (sources) => {
    const read = dataReader(options);
    const nav: ReadonlyArray<NavEntry> = sources.map((page) => ({
      output: outputOf(page.file),
      title: titleOf(page),
    }));
    const located = sources.map((page) =>
      fencesOf(page.text).map(
        (fence): Located => ({ file: page.file, line: fence.line, drawn: draw(fence, read) }),
      ),
    );
    const pages = sources.map((page, i): BuiltPage => {
      const output = outputOf(page.file);
      const title = titleOf(page);
      const body = bodyOf(page.text, (located[i] ?? []).map(figureOf));
      return { file: page.file, output, title, html: documentOf({ title, output, nav, body }) };
    });
    return {
      pages,
      charts: located.flat().flatMap(chartOf),
      problems: located.flat().flatMap(problemOf),
    };
  });
}
