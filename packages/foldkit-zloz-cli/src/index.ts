/**
 * Effect command tree for the standalone Zloz CLI. Importing never starts a process.
 * @module CLI
 */
import type { ZlozGraph } from '@opsydyn/foldkit-zloz';
import {
  exportMermaid,
  type MermaidDirection,
  type MermaidLossPolicy,
} from '@opsydyn/foldkit-zloz-mermaid';
import { Console, Effect, Match, Stdio } from 'effect';
import { CliError, CliOutput, Command, Flag } from 'effect/cli';

import manifest from '../package.json';
import { readGraph, writeResponse } from './io';
import {
  cliProtocol,
  CliInputError,
  CliConversionRejected,
  CliInvocationRejected,
  encodeResponse,
  type CliOperation,
  type CliResponse,
} from './protocol';
export { inputByteLimit, readGraph } from './io';
export {
  cliProtocol,
  CliDiagnostic,
  CliInputError,
  CliOutputError,
  CliConversionRejected,
  CliInvocationRejected,
} from './protocol';
export type { CliOperation, CliResponse } from './protocol';

type Operation = Exclude<CliOperation, 'invocation'>;
function rejectInput(operation: Operation, error: CliInputError) {
  return Effect.gen(function* () {
    const response: CliResponse = {
      protocol: cliProtocol,
      operation,
      status: 'rejected',
      diagnostics: [
        {
          code: error.code,
          message: error.message,
          dimension: error.dimension,
          subject: error.subject,
          severity: 'error',
        },
      ],
    };
    yield* writeResponse(response);
    return yield* Effect.fail(error);
  });
}
function readForOperation(operation: Operation, input: string) {
  return readGraph(input).pipe(
    Effect.catchTag(['CliInputError'], (error) => rejectInput(operation, error)),
  );
}
function execute(operation: Operation, input: string, project: (graph: ZlozGraph) => CliResponse) {
  return Effect.gen(function* () {
    const graph = yield* readForOperation(operation, input);
    const response = project(graph);
    yield* writeResponse(response).pipe(
      Effect.filterOrFail(
        (value) => value.status !== 'rejected',
        () => new CliConversionRejected(),
      ),
    );
  });
}
const summarize = (graph: ZlozGraph): CliResponse => ({
  protocol: cliProtocol,
  operation: 'validate',
  status: 'valid',
  summary: { nodes: graph.nodes.length, edges: graph.edges.length },
  diagnostics: [],
});
const convert =
  (direction: MermaidDirection, lossPolicy: MermaidLossPolicy) =>
  (graph: ZlozGraph): CliResponse =>
    Match.value(exportMermaid(graph, { direction, lossPolicy })).pipe(
      Match.when(
        { status: 'converted' },
        (result) =>
          ({
            protocol: cliProtocol,
            operation: 'mermaid-export',
            status: 'converted',
            data: result.value,
            diagnostics: result.diagnostics,
          }) as const,
      ),
      Match.orElse(
        (result) =>
          ({
            protocol: cliProtocol,
            operation: 'mermaid-export',
            status: 'rejected',
            diagnostics: result.diagnostics,
          }) as const,
      ),
    );
const input = Flag.String('input').pipe(
  Flag.withAlias('i'),
  Flag.withDefault('-'),
  Flag.withDescription('Version-one Zloz JSON file, or - for stdin (1 MiB maximum).'),
);
const direction = Flag.Literals('direction', ['LR', 'RL', 'TB', 'BT']).pipe(Flag.withDefault('LR'));
const lossPolicy = Flag.Literals('loss-policy', ['reject', 'report']).pipe(
  Flag.withDefault('reject'),
  Flag.withDescription('Reject conversion losses by default; report explicitly consents to them.'),
);
const validate = Command.make('validate', { input }, (config) =>
  execute('validate', config.input, summarize),
).pipe(
  Command.withDescription(
    'Validate a canonical version-one Zloz document and report node/edge counts.',
  ),
);
const exportCommand = Command.make('export', { input, direction, lossPolicy }, (config) =>
  execute('mermaid-export', config.input, convert(config.direction, config.lossPolicy)),
).pipe(
  Command.withDescription(
    'Export the qualified Mermaid subset with identity and conversion-loss diagnostics.',
  ),
);
const mermaidCommand = Command.make('mermaid').pipe(
  Command.withDescription('Loss-aware Mermaid projections.'),
  Command.withSubcommands([exportCommand]),
);
export const zlozCommand = Command.make('zloz').pipe(
  Command.withDescription(
    'Compose systems. Connect ideas. Validate Zloz models and export Mermaid as JSON.',
  ),
  Command.withSubcommands([validate, mermaidCommand]),
);

type InvalidInvocation = Extract<CliOutput.Presenter.Event, { readonly _tag: 'InvalidInvocation' }>;
function showInvocationError(event: InvalidInvocation) {
  return Effect.gen(function* () {
    const formatter = yield* CliOutput.Formatter;
    const response: CliResponse = {
      protocol: cliProtocol,
      operation: 'invocation',
      status: 'rejected',
      diagnostics: [
        {
          code: 'invalid-arguments',
          message: formatter.formatErrors(event.errors),
          severity: 'error',
          dimension: 'syntax',
          subject: null,
        },
      ],
    };
    yield* Console.error(encodeResponse(response));
  });
}
function present(event: CliOutput.Presenter.Event) {
  return Match.value(event).pipe(
    Match.tag('InvalidInvocation', showInvocationError),
    Match.orElse(CliOutput.defaultPresenter.present),
  );
}
const presenter = CliOutput.layerPresenter({ present });
function normalizeHelp(error: CliError.ShowHelp) {
  return Match.value(error.errors.length).pipe(
    Match.when(0, () => error),
    Match.orElse(() => new CliInvocationRejected()),
  );
}
type ExecutionError = Command.Error<typeof zlozCommand> | CliError.CliError;
export type CliExecutionError = ExecutionError | CliInvocationRejected;
export type CliEnvironment = Command.Environment;
function normalizeError(error: ExecutionError) {
  return Match.value(error).pipe(
    Match.tag('ShowHelp', normalizeHelp),
    Match.orElse((error) => error),
  );
}
function reportOutputError() {
  const response: CliResponse = {
    protocol: cliProtocol,
    operation: 'invocation',
    status: 'rejected',
    diagnostics: [
      {
        code: 'output-unavailable',
        message: 'Cannot write the command result.',
        subject: null,
        severity: 'error',
        dimension: 'io',
      },
    ],
  };
  return Console.error(encodeResponse(response));
}
/** Explicit argv seam for embedding/testing; platform services remain injectable. */
export function run(args: readonly string[]) {
  const execution = Command.runWith(zlozCommand, { version: manifest.version })(args).pipe(
    Effect.mapError(normalizeError),
    Effect.tapErrorTag('CliOutputError', reportOutputError),
    Effect.provide(presenter),
  );
  return execution.pipe(Effect.withSpan('zloz.cli.run'));
}
/** Reads argv from Effect Stdio; the executable alone supplies platform/runtime. */
export const program = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio;
  const args = yield* stdio.args;
  yield* run(args);
});
