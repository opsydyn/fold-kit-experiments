/**
 * Effect command tree for the standalone Zloz CLI. Importing never starts a process.
 * @module CLI
 */
import type { ZlozGraph, ZlozSnapshot } from '@opsydyn/foldkit-zloz';
import {
  exportMermaid,
  type MermaidDirection,
  type MermaidLossPolicy,
} from '@opsydyn/foldkit-zloz-mermaid';
import { Console, Effect, Match, Stdio } from 'effect';
import { CliError, CliOutput, Command, Flag } from 'effect/cli';

import manifest from '../package.json';
import { readDocument, writeResponse, type CliDocument } from './io';
import {
  cliProtocol,
  CliInputError,
  type CliDiagnostic,
  CliConversionRejected,
  CliInvocationRejected,
  encodeResponse,
  type CliOperation,
  type CliResponse,
} from './protocol';
export { inputByteLimit, readGraph, readDocument } from './io';
export type { CliDocument } from './io';
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
  return readDocument(input).pipe(
    Effect.catchTag(['CliInputError'], (error) => rejectInput(operation, error)),
  );
}
function execute(
  operation: Operation,
  input: string,
  project: (document: CliDocument) => CliResponse,
) {
  return Effect.gen(function* () {
    const document = yield* readForOperation(operation, input);
    const response = project(document);
    yield* writeResponse(response).pipe(
      Effect.filterOrFail(
        (value) => value.status !== 'rejected',
        () => new CliConversionRejected(),
      ),
    );
  });
}
const graphOf = (document: CliDocument): ZlozGraph =>
  Match.value(document).pipe(
    Match.when({ kind: 'model' }, (value) => value.document.snapshot.graph),
    Match.orElse((value) => value.snapshot.graph),
  );
const summarize = (document: CliDocument): CliResponse => {
  const graph = graphOf(document);
  const response: Extract<CliResponse, { status: 'valid' }> = {
    protocol: cliProtocol,
    operation: 'validate' as const,
    status: 'valid' as const,
    summary: { nodes: graph.nodes.length, edges: graph.edges.length },
    diagnostics: [],
  };
  return Match.value(document).pipe(
    Match.when({ kind: 'model' }, ({ document }) => ({
      ...response,
      model: {
        id: document.id,
        name: document.name,
        editions: document.editions.length,
        origin: document.origin
          ? { modelId: document.origin.modelId, editionId: document.origin.edition.id }
          : null,
      },
    })),
    Match.orElse(() => response),
  );
};
const snapshotLosses = (snapshot: ZlozSnapshot): readonly CliDiagnostic[] =>
  Match.value(snapshot.viewport).pipe(
    Match.when(undefined, () => []),
    Match.orElse(() => [
      {
        code: 'viewport-omitted',
        severity: 'loss' as const,
        dimension: 'layout' as const,
        subject: null,
        message: 'The snapshot camera is omitted from Mermaid.',
      },
    ]),
  );
const metadataLosses = (document: CliDocument): readonly CliDiagnostic[] =>
  Match.value(document).pipe(
    Match.when({ kind: 'model' }, ({ document }) => [
      {
        code: 'model-metadata-omitted',
        severity: 'loss' as const,
        dimension: 'identity' as const,
        subject: document.id,
        message:
          'Mermaid projects only the current graph; model identity, editions, lineage and capture camera are omitted. Keep model JSON as the authoritative document.',
      },
    ]),
    Match.orElse((value) => snapshotLosses(value.snapshot)),
  );
const rejectConversion = (diagnostics: readonly CliDiagnostic[]): CliResponse => ({
  protocol: cliProtocol,
  operation: 'mermaid-export',
  status: 'rejected',
  diagnostics,
});
const convert =
  (direction: MermaidDirection, lossPolicy: MermaidLossPolicy) =>
  (document: CliDocument): CliResponse => {
    const losses = metadataLosses(document);
    const result = exportMermaid(graphOf(document), { direction, lossPolicy });
    const diagnostics = [...result.diagnostics, ...losses];
    return Match.value({ result, policy: lossPolicy, hasMetadataLoss: losses.length > 0 }).pipe(
      Match.when({ result: { status: 'converted' }, policy: 'reject', hasMetadataLoss: true }, () =>
        rejectConversion(diagnostics),
      ),
      Match.when(
        { result: { status: 'converted' } },
        ({ result }): CliResponse => ({
          protocol: cliProtocol,
          operation: 'mermaid-export',
          status: 'converted',
          data: result.value,
          diagnostics,
        }),
      ),
      Match.orElse(() => rejectConversion(diagnostics)),
    );
  };
const input = Flag.String('input').pipe(
  Flag.withAlias('i'),
  Flag.withDefault('-'),
  Flag.withDescription(
    'Version-one graph, snapshot or model JSON file, or - for stdin (1 MiB maximum).',
  ),
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
