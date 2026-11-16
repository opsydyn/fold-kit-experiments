/**
 * The `foldkit-dash` command tree: `new`, `build`, `check` and `describe`. Importing
 * never starts a process; `bin.ts` does.
 * @module CLI
 */
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { Console, Effect, FileSystem, Match, type PlatformError, Stdio } from 'effect';
import { Argument, CliError, Command, Flag } from 'effect/cli';

import manifest from '../package.json';
import type { DataOptions } from './data';
import {
  type Chart,
  DashInvocationError,
  DashProblems,
  encodeEnvelope,
  type Envelope,
  type Problem,
  protocol,
} from './problems';
import { analyse, type Report } from './project';
import { starter } from './template';

export { analyse, readPages, type BuiltPage, type Report } from './project';
export { dataReader, cacheDirectory, Rows, type DataOptions } from './data';
export { bodyOf, documentOf, fencesOf, hrefFrom, outputOf, titleOf } from './page';
export * from './problems';
export { starter, schemaUrl } from './template';

const root = Flag.String('root').pipe(
  Flag.withAlias('C'),
  Flag.withDefault('.'),
  Flag.withDescription('The project folder, holding pages/ and data/.'),
);
const fresh = Flag.Boolean('fresh').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Run every data loader again instead of using its cached output.'),
);
const json = Flag.Boolean('json').pipe(
  Flag.withDefault(false),
  Flag.withDescription(`Answer with a ${protocol} JSON envelope on stdout.`),
);
const loaderTimeout = Flag.Int('loader-timeout').pipe(
  Flag.withDefault(60),
  Flag.withDescription('Seconds a data loader may run before it is a problem.'),
);
const out = Flag.String('out').pipe(
  Flag.withDefault('dist'),
  Flag.withDescription('Where build writes the site, inside the project.'),
);

type Command = Envelope['command'];

const envelope = (
  command: Command,
  report: Pick<Report, 'problems'> & { readonly pages: ReadonlyArray<string> },
  charts: ReadonlyArray<Chart>,
  written: ReadonlyArray<string>,
): Envelope => ({
  protocol,
  command,
  status: report.problems.length === 0 ? 'ok' : 'problems',
  pages: report.pages,
  charts,
  problems: report.problems,
  written,
});

/** A problem as a line: where, what kind, and the message (which names any spec path). */
const problemLine = (problem: Problem): string =>
  `${problem.file}:${problem.line} ${problem.kind}: ${problem.message}`;

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** Prints a result, as text or the envelope; fails with exit 1 when there are problems. */
function finish(json: boolean, result: Envelope, text: ReadonlyArray<string>) {
  const running = Effect.gen(function* () {
    yield* Console.log(json ? encodeEnvelope(result) : text.join('\n'));
    if (result.problems.length > 0) {
      return yield* new DashProblems({ count: result.problems.length });
    }
  });
  return running.pipe(Effect.withSpan('foldkit-dash.finish'));
}

type ReadOptions = {
  readonly root: string;
  readonly fresh: boolean;
  readonly loaderTimeout: number;
};

const optionsOf = (config: ReadOptions): DataOptions => ({
  root: resolve(config.root),
  fresh: config.fresh,
  timeout: config.loaderTimeout * 1000,
});

const summary = (report: Report): string => {
  const problems =
    report.problems.length === 0 ? 'no problems' : plural(report.problems.length, 'problem');
  const charts = plural(report.charts.length + report.problems.length, 'chart');
  return `${plural(report.pages.length, 'page')}, ${charts}, ${problems}.`;
};

const pagesOf = (report: Report): ReadonlyArray<string> => report.pages.map((page) => page.file);

function checked(config: ReadOptions & { readonly json: boolean }) {
  const running = Effect.gen(function* () {
    const report = yield* Effect.fromResult(analyse(optionsOf(config)));
    const result = envelope('check', { pages: pagesOf(report), problems: report.problems }, [], []);
    yield* finish(config.json, result, [...report.problems.map(problemLine), summary(report)]);
  });
  return running.pipe(Effect.withSpan('foldkit-dash.check'));
}

const check = Command.make('check', { root, fresh, json, loaderTimeout }, checked).pipe(
  Command.withDescription(
    'Read every page, load its data and compile its charts, writing nothing; exit 1 if anything is wrong.',
  ),
);

function described(config: ReadOptions & { readonly json: boolean }) {
  const running = Effect.gen(function* () {
    const report = yield* Effect.fromResult(analyse(optionsOf(config)));
    const result = envelope(
      'describe',
      { pages: pagesOf(report), problems: report.problems },
      report.charts,
      [],
    );
    yield* finish(config.json, result, [
      ...report.charts.map((chart) => `${chart.file}:${chart.line} ${chart.summary}`),
      ...report.problems.map(problemLine),
    ]);
  });
  return running.pipe(Effect.withSpan('foldkit-dash.describe'));
}

const describe = Command.make('describe', { root, fresh, json, loaderTimeout }, described).pipe(
  Command.withDescription('Say what each chart shows, in words, by page and line.'),
);

/** Whether `out` is a safe folder to replace: inside the project, and not a source. */
const isOutputFolder = (projectRoot: string, folder: string): boolean => {
  const inside = relative(projectRoot, folder);
  const top = inside.split(/[\\/]/)[0] ?? '';
  return (
    inside !== '' &&
    !inside.startsWith('..') &&
    !isAbsolute(inside) &&
    !['pages', 'data', 'node_modules'].includes(top)
  );
};

/** Writes `text` at `target`, making its folder first. */
function writeText(target: string, text: string) {
  const running = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.makeDirectory(dirname(target), { recursive: true });
    yield* fs.writeFileString(target, text);
  });
  return running.pipe(Effect.withSpan('foldkit-dash.write'));
}

function built(config: ReadOptions & { readonly json: boolean; readonly out: string }) {
  const running = Effect.gen(function* () {
    const options = optionsOf(config);
    const folder = resolve(options.root, config.out);
    if (!isOutputFolder(options.root, folder)) {
      return yield* new DashInvocationError({
        message: `--out ${config.out} must be a folder inside the project other than pages/, data/ or node_modules/`,
      });
    }
    const report = yield* Effect.fromResult(analyse(options));
    const fs = yield* FileSystem.FileSystem;
    // The folder is the build's alone: what an earlier build wrote and this one does not
    // goes, so a removed page does not linger.
    yield* fs.remove(folder, { recursive: true, force: true });
    yield* Effect.forEach(report.pages, (page) => writeText(join(folder, page.output), page.html));
    const written = report.pages.map((page) => relative(options.root, join(folder, page.output)));
    const result = envelope(
      'build',
      { pages: pagesOf(report), problems: report.problems },
      [],
      written,
    );
    yield* finish(config.json, result, [
      ...report.problems.map(problemLine),
      `${summary(report)} Wrote ${relative(options.root, folder)}/.`,
    ]);
  });
  return running.pipe(Effect.withSpan('foldkit-dash.build'));
}

const build = Command.make('build', { root, out, fresh, json, loaderTimeout }, built).pipe(
  Command.withDescription(
    'Build every page to static HTML (no JavaScript); exit 1 if any chart has a problem, which the page then shows.',
  ),
);

function started(config: { readonly dir: string; readonly json: boolean }) {
  const running = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const folder = resolve(config.dir);
    const existing = (yield* fs.exists(folder)) ? yield* fs.readDirectory(folder) : [];
    if (existing.length > 0) {
      return yield* new DashInvocationError({
        message: `${config.dir} is not empty: start a project in a new folder`,
      });
    }
    yield* Effect.forEach(starter, ([path, text]) => writeText(join(folder, path), text));
    const written = starter.map(([path]) => path);
    const result = envelope('new', { pages: ['pages/index.md'], problems: [] }, [], written);
    yield* finish(config.json, result, [
      `Started ${config.dir}: ${written.join(', ')}.`,
      `Next: cd ${config.dir} && bunx foldkit-dash check, then build. AGENTS.md has the loop.`,
    ]);
  });
  return running.pipe(Effect.withSpan('foldkit-dash.new'));
}

const dir = Argument.String('dir').pipe(Argument.withDescription('A new or empty folder.'));

const create = Command.make('new', { dir, json }, started).pipe(
  Command.withDescription('Start a project: a page, a data loader and AGENTS.md.'),
);

export const foldkitDash = Command.make('foldkit-dash').pipe(
  Command.withDescription(
    'Static dashboards from Markdown pages, foldkit-viz plot specs and build-time data loaders.',
  ),
  Command.withSubcommands([create, check, describe, build]),
);

/** Says why the command cannot run, then fails with exit 2. */
function refused(message: string) {
  const running = Effect.gen(function* () {
    yield* Console.error(`foldkit-dash: ${message}`);
    return yield* new DashInvocationError({ message });
  });
  return running.pipe(Effect.withSpan('foldkit-dash.refused'));
}

/** Effect's CLI has already shown what was wrong with the arguments. */
const invalidArguments = (): DashInvocationError =>
  new DashInvocationError({ message: 'invalid arguments' });

/** A command-line mistake (not help asked for) exits 2; a refusal says why first. */
function invocation(
  error: CliError.CliError | DashInvocationError | DashProblems | PlatformError.PlatformError,
) {
  return Match.value(error).pipe(
    Match.tag('ShowHelp', (help) =>
      help.errors.length === 0 ? Effect.void : Effect.fail(invalidArguments()),
    ),
    Match.tag('DashInvocationError', (failure) => refused(failure.message)),
    Match.tag('DashProblems', (problems) => Effect.fail(problems)),
    Match.tag('PlatformError', (failure) => refused(failure.message)),
    Match.orElse(() => Effect.fail(invalidArguments())),
  );
}

/** Runs the command tree on `args`; an embedding or a test supplies the platform. */
export function run(args: ReadonlyArray<string>) {
  const running = Effect.gen(function* () {
    yield* Command.runWith(foldkitDash, { version: manifest.version })(args).pipe(
      Effect.catch(invocation),
    );
  });
  return running.pipe(Effect.withSpan('foldkit-dash.run'));
}

/** Reads argv from Effect's Stdio; `bin.ts` supplies the Bun platform. */
export const program = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio;
  yield* run(yield* stdio.args);
});
