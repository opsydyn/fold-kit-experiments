/**
 * Data for plot fences: a file in `data/`, or the output of a loader beside it
 * (`data/name.json.ts` makes `name.json`). Loaders run with Bun at build time; their
 * output is cached under `node_modules/.cache/foldkit-dash/` until the loader changes.
 * As in Observable Framework, a data file of the same name wins over a loader.
 * @module Data
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';

import { Result, Schema } from 'effect';

import { delimiterOf, parseDelimited } from './csv';
import { Rows } from './rows';

export { Rows } from './rows';

const RowsText = Schema.fromJsonString(Rows);

/** Why data could not be had: missing (`data`), a loader that failed (`loader`), or not rows. */
export type DataProblem = { readonly kind: 'data' | 'loader' | 'rows'; readonly message: string };

export type DataOptions = {
  readonly root: string;
  /** Run every loader again, ignoring the cache. */
  readonly fresh: boolean;
  /** How long a loader may run, in milliseconds. */
  readonly timeout: number;
};

/** Where loader output is kept between builds. */
export const cacheDirectory = (root: string): string =>
  join(root, 'node_modules', '.cache', 'foldkit-dash');

/** A name inside `data/`: no absolute paths, no `..`, no hidden folders. */
const isDataName = (name: string): boolean =>
  name !== '' &&
  !posix.isAbsolute(name) &&
  posix.normalize(name) === name &&
  !name.split('/').some((part) => part === '..' || part.startsWith('.'));

/** Rows from a data file or loader's text: CSV or TSV by the name's extension, else JSON. */
const decodeRows = (text: string, name: string): Result.Result<Rows, DataProblem> => {
  const delimiter = delimiterOf(name);
  if (delimiter !== undefined) return Result.succeed(parseDelimited(text, delimiter));
  return Result.mapError(Schema.decodeUnknownResult(RowsText)(text), (error) => ({
    kind: 'rows' as const,
    message: `${name} is not rows of plain values: ${error.message}`,
  }));
};

/**
 * The program each loader extension runs with, as Observable Framework's loaders do:
 * JavaScript and TypeScript with Bun, Python, shell and R with their own.
 */
export const interpreters: ReadonlyArray<readonly [extension: string, program: string]> = [
  ['ts', 'bun'],
  ['js', 'bun'],
  ['py', 'python3'],
  ['sh', 'sh'],
  ['R', 'Rscript'],
];

/** A loader found for a data name: its file and the program that runs it. */
type Loader = { readonly file: string; readonly program: string; readonly shown: string };

/** Runs a loader, keeping its output; a failure or a run past `timeout` is a problem. */
const runLoader = (
  options: DataOptions,
  loader: Loader,
  cached: string,
): Result.Result<string, DataProblem> => {
  if (Bun.which(loader.program) === null) {
    return Result.fail({
      kind: 'loader',
      message: `loader ${loader.shown} runs with ${loader.program}, which is not on the PATH`,
    });
  }
  const run = Bun.spawnSync([loader.program, loader.file], {
    cwd: options.root,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: options.timeout,
  });
  if (run.exitedDueToTimeout === true) {
    return Result.fail({
      kind: 'loader',
      message: `loader ${loader.shown} ran past ${options.timeout / 1000} s`,
    });
  }
  if (run.exitCode !== 0) {
    const said = run.stderr.toString().trim().split('\n').slice(-5).join('\n');
    return Result.fail({
      kind: 'loader',
      message: `loader ${loader.shown} exited with ${run.exitCode}${said === '' ? '' : `: ${said}`}`,
    });
  }
  mkdirSync(posix.dirname(cached), { recursive: true });
  writeFileSync(cached, run.stdout);
  return Result.succeed(run.stdout.toString());
};

/** Whether a loader's cached output is still its output. */
const isFresh = (options: DataOptions, loader: string, cached: string): boolean =>
  !options.fresh && existsSync(cached) && statSync(cached).mtimeMs >= statSync(loader).mtimeMs;

/** The one loader that makes `name`, none, or why there are too many. */
const loaderFor = (
  options: DataOptions,
  name: string,
): Result.Result<Loader | undefined, DataProblem> => {
  const found = interpreters.flatMap(([extension, program]) => {
    const file = join(options.root, 'data', `${name}.${extension}`);
    return existsSync(file) ? [{ file, program, shown: `data/${name}.${extension}` }] : [];
  });
  if (found.length > 1) {
    return Result.fail({
      kind: 'loader',
      message: `${found.map((each) => each.shown).join(' and ')} both make ${name}: keep one`,
    });
  }
  return Result.succeed(found[0]);
};

/** The text a name stands for: its data file, else its loader's (cached) output. */
const textOf = (
  options: DataOptions,
  name: string,
  ran: Set<string>,
): Result.Result<string, DataProblem> => {
  if (!isDataName(name)) {
    return Result.fail({ kind: 'data', message: `"${name}" is not a file name inside data/` });
  }
  const file = join(options.root, 'data', name);
  if (existsSync(file)) return Result.succeed(readFileSync(file, 'utf8'));
  return Result.flatMap(loaderFor(options, name), (loader) => {
    if (loader === undefined) {
      return Result.fail({
        kind: 'data',
        message: `no data/${name}, and no loader (data/${name}.ts, .js, .py, .sh or .R) to make it`,
      });
    }
    const cached = join(cacheDirectory(options.root), name);
    // `--fresh` runs each loader once per build, however many fences use it.
    if (isFresh(options, loader.file, cached) || ran.has(name)) {
      return Result.succeed(readFileSync(cached, 'utf8'));
    }
    ran.add(name);
    return runLoader(options, loader, cached);
  });
};

/**
 * A data reader for one build: each name read, run and decoded once, its result kept for
 * every fence that uses it.
 */
export const dataReader = (
  options: DataOptions,
): ((name: string) => Result.Result<Rows, DataProblem>) => {
  const ran = new Set<string>();
  const read = new Map<string, Result.Result<Rows, DataProblem>>();
  return (name) => {
    const rows =
      read.get(name) ??
      Result.flatMap(textOf(options, name, ran), (text) => decodeRows(text, name));
    read.set(name, rows);
    return rows;
  };
};
