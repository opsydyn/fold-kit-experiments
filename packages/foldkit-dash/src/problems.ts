/**
 * What `check`, `build` and `describe` report: problems with where they are, and the
 * versioned JSON envelope an agent reads. Typed errors carry the process's exit code.
 * @module Problems
 */
import { Data, Runtime, Schema } from 'effect';

/** The envelope's protocol; a change that breaks readers gets a new version. */
export const protocol = 'foldkit-dash/v1';

/**
 * What went wrong: a fence that is not JSON, a spec `compilePlot` refuses, data that is
 * missing, a loader that fails or runs too long, or rows that do not decode.
 */
export const ProblemKind = Schema.Literals(['json', 'spec', 'data', 'loader', 'rows']);
export type ProblemKind = typeof ProblemKind.Type;

/** A problem, at a page's line (the fence's opening line), with its spec path when known. */
export const Problem = Schema.Struct({
  kind: ProblemKind,
  file: Schema.String,
  line: Schema.Int,
  path: Schema.NullOr(Schema.String),
  message: Schema.String,
});
export type Problem = typeof Problem.Type;

/** A chart as `describe` reports it: where it is, and what `describePlot` says it shows. */
export const Chart = Schema.Struct({
  file: Schema.String,
  line: Schema.Int,
  summary: Schema.String,
});
export type Chart = typeof Chart.Type;

/** What a command answers with `--json`. */
export const Envelope = Schema.Struct({
  protocol: Schema.Literal(protocol),
  command: Schema.Literals(['build', 'check', 'describe', 'new']),
  status: Schema.Literals(['ok', 'problems']),
  pages: Schema.Array(Schema.String),
  charts: Schema.Array(Chart),
  problems: Schema.Array(Problem),
  written: Schema.Array(Schema.String),
});
export type Envelope = typeof Envelope.Type;

export const encodeEnvelope = Schema.encodeSync(Schema.fromJsonString(Envelope));

/** The spec path at the start of a `compilePlot` message, such as `marks[0].y`. */
export const specPathOf = (message: string): string | null =>
  /^((?:[A-Za-z_$][\w$]*|\[\d+\])(?:\.[A-Za-z_$][\w$]*|\[\d+\])*):\s/.exec(message)?.[1] ?? null;

/** The project has problems: exit 1. They have been reported already. */
export class DashProblems extends Data.TaggedError('DashProblems')<{ readonly count: number }> {
  readonly [Runtime.errorExitCode] = 1;
  readonly [Runtime.errorReported] = false;
}

/** The command cannot run as asked (no project, a target that exists): exit 2. */
export class DashInvocationError extends Data.TaggedError('DashInvocationError')<{
  readonly message: string;
}> {
  readonly [Runtime.errorExitCode] = 2;
  readonly [Runtime.errorReported] = false;
}
