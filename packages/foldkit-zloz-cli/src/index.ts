/**
 * Effect command tree for the standalone Zloz CLI. Importing never starts a process.
 * @module CLI
 */
import {
  parseModellingPatch,
  dryRunModellingPatch,
  auditDddRelationships,
  auditEventStormingRelationships,
  compareModelEventStormingRelationships,
  type ZlozDddRelationshipOptions,
  type ZlozGraph,
  type ZlozSnapshot,
  type ZlozEventStormingRelationshipOptions,
} from '@opsydyn/foldkit-zloz';
import {
  exportMermaid,
  createReviewPacket,
  parseReviewPacket,
  type ZlozReviewPacket,
  type ZlozReviewPacketParseResult,
  type MermaidDirection,
  type MermaidLossPolicy,
} from '@opsydyn/foldkit-zloz-mermaid';
import { Console, Effect, Match, Option, Result, Stdio } from 'effect';
import { CliError, CliOutput, Command, Flag } from 'effect/cli';

import manifest from '../package.json';
import { readDddRelationshipRules } from './ddd-relationship-rules';
import { readDocument, readTextInput, writeResponse, type CliDocument } from './io';
import {
  cliProtocol,
  CliInputError,
  type CliDiagnostic,
  CliConversionRejected,
  CliAuditIncompatible,
  CliAuditRegression,
  CliReviewInputRejected,
  CliPatchRejected,
  CliInvocationRejected,
  encodeResponse,
  type CliOperation,
  type CliResponse,
} from './protocol';
import { readRelationshipRules } from './relationship-rules';
export { inputByteLimit, readGraph, readDocument } from './io';
export type { CliDocument } from './io';
export {
  cliProtocol,
  CliDiagnostic,
  CliInputError,
  CliOutputError,
  CliConversionRejected,
  CliAuditIncompatible,
  CliAuditRegression,
  CliReviewInputRejected,
  CliPatchRejected,
  CliInvocationRejected,
} from './protocol';
export type { CliOperation, CliResponse, CliReviewPacketSummary } from './protocol';

type Operation = Exclude<CliOperation, 'invocation'>;
function rejectInput(operation: Operation, error: CliInputError) {
  return Effect.gen(function* () {
    const diagnostic: CliDiagnostic = {
      code: error.code,
      message: error.message,
      dimension: error.dimension,
      subject: error.subject,
      severity: 'error',
    };
    const response: CliResponse = {
      protocol: cliProtocol,
      operation,
      status: 'rejected',
      diagnostics: [error.path === undefined ? diagnostic : { ...diagnostic, path: error.path }],
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
function requireModel(document: CliDocument, input: string, operation: Operation) {
  const result = Match.value(document).pipe(
    Match.when({ kind: 'model' }, ({ document }) => Result.succeed(document)),
    Match.orElse(() =>
      Result.fail(
        new CliInputError({
          code: 'model-required',
          message: 'Edition comparison requires a Zloz model document.',
          dimension: 'identity',
          subject: input,
        }),
      ),
    ),
  );
  return Effect.fromResult(result).pipe(
    Effect.catchTag('CliInputError', (error) => rejectInput(operation, error)),
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
    const reporting = writeResponse(response).pipe(
      Effect.filterOrFail(
        (value) => value.status !== 'rejected',
        () => new CliConversionRejected(),
      ),
    );
    yield* reporting;
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
const readAuditRules = (operation: Operation) => (input: string) =>
  readRelationshipRules(input).pipe(
    Effect.catchTag('CliInputError', (error) => rejectInput(operation, error)),
  );
function executeAudit(input: string, rules: Option.Option<string>) {
  const auditing = Effect.gen(function* () {
    const readingRules = Option.match(rules, {
      onNone: () => Effect.succeed<ZlozEventStormingRelationshipOptions>({}),
      onSome: readAuditRules('relationships-audit'),
    });
    const options = yield* readingRules;
    const document = yield* readForOperation('relationships-audit', input);
    const data = auditEventStormingRelationships(graphOf(document), options);
    const modelId = Match.value(document).pipe(
      Match.when({ kind: 'model' }, ({ document }) => document.id),
      Match.orElse(() => null),
    );
    const conventions = Option.match(rules, {
      onNone: () => ({ source: 'builtin' as const, input: null }),
      onSome: (input) => ({ source: 'file' as const, input }),
    });
    const response: Extract<CliResponse, { status: 'audited' }> = {
      protocol: cliProtocol,
      operation: 'relationships-audit',
      status: 'audited',
      scope: 'current-graph',
      modelId,
      conventions,
      data,
      diagnostics: data.entries
        .filter((entry) => entry.status === 'blocked')
        .map((entry) => ({
          code: `relationship-${entry.code}`,
          message: entry.message,
          subject: entry.edgeId,
          severity: 'error',
          dimension: 'semantics',
        })),
    };
    const reporting = writeResponse(response).pipe(
      Effect.filterOrFail(
        () => data.status === 'compatible',
        () => new CliAuditIncompatible(),
      ),
    );
    yield* reporting;
  });
  return auditing.pipe(Effect.withSpan('zloz.cli.auditRelationships'));
}
const readDddAuditRules = (input: string) =>
  readDddRelationshipRules(input).pipe(
    Effect.catchTag('CliInputError', (error) => rejectInput('ddd-audit', error)),
  );
/** ADR 0079: a distinct operation preserves causal command and convention-file compatibility. */
function executeDddAudit(input: string, rules: Option.Option<string>) {
  const auditing = Effect.gen(function* () {
    const readingRules = Option.match(rules, {
      onNone: () => Effect.succeed<ZlozDddRelationshipOptions>({}),
      onSome: readDddAuditRules,
    });
    const options = yield* readingRules;
    const document = yield* readForOperation('ddd-audit', input);
    const data = auditDddRelationships(graphOf(document), options);
    const modelId = Match.value(document).pipe(
      Match.when({ kind: 'model' }, ({ document }) => document.id),
      Match.orElse(() => null),
    );
    const conventions = Option.match(rules, {
      onNone: () => ({ source: 'builtin' as const, input: null }),
      onSome: (input) => ({ source: 'file' as const, input }),
    });
    const response: Extract<CliResponse, { operation: 'ddd-audit'; status: 'audited' }> = {
      protocol: cliProtocol,
      operation: 'ddd-audit',
      status: 'audited',
      scope: 'current-graph',
      modelId,
      conventions,
      data,
      diagnostics: data.entries
        .filter((entry) => entry.status === 'blocked')
        .map((entry) => ({
          code: `ddd-relationship-${entry.code}`,
          message: entry.message,
          subject: entry.edgeId,
          severity: 'error',
          dimension: 'semantics',
        })),
    };
    const reporting = writeResponse(response).pipe(
      Effect.filterOrFail(
        () => data.status === 'compatible',
        () => new CliAuditIncompatible(),
      ),
    );
    yield* reporting;
  });
  return auditing.pipe(Effect.withSpan('zloz.cli.auditDddRelationships'));
}
function executeComparison(
  input: string,
  baselineId: string,
  edition: Option.Option<string>,
  rules: Option.Option<string>,
) {
  const comparing = Effect.gen(function* () {
    const readingRules = Option.match(rules, {
      onNone: () => Effect.succeed<ZlozEventStormingRelationshipOptions>({}),
      onSome: readAuditRules('relationships-compare'),
    });
    const options = yield* readingRules;
    const document = yield* readForOperation('relationships-compare', input);
    const model = yield* requireModel(document, input, 'relationships-compare');
    const selection = Option.match(edition, {
      onNone: () => ({ baselineId }),
      onSome: (selectedId) => ({ baselineId, selectedId }),
    });
    const result = compareModelEventStormingRelationships(model, selection, options);
    const comparisonResult = Match.value(result).pipe(
      Match.when({ type: 'compared' }, ({ comparison }) => Result.succeed(comparison)),
      Match.orElse((result) =>
        Result.fail(
          new CliInputError({
            code: result.code,
            message: result.reason,
            dimension: 'identity',
            subject: result.editionId,
          }),
        ),
      ),
    );
    const selectingComparison = Effect.fromResult(comparisonResult).pipe(
      Effect.catchTag('CliInputError', (error) => rejectInput('relationships-compare', error)),
    );
    const data = yield* selectingComparison;
    const conventions = Option.match(rules, {
      onNone: () => ({ source: 'builtin' as const, input: null }),
      onSome: (input) => ({ source: 'file' as const, input }),
    });
    const response: Extract<CliResponse, { status: 'compared' }> = {
      protocol: cliProtocol,
      operation: 'relationships-compare',
      status: 'compared',
      scope: 'model-editions',
      conventions,
      data,
      diagnostics: data.introduced.map((entry) => ({
        code: `relationship-${entry.code}`,
        message: entry.message,
        subject: entry.edgeId,
        severity: 'error',
        dimension: 'semantics',
      })),
    };
    const reporting = writeResponse(response).pipe(
      Effect.filterOrFail(
        () => data.summary.introduced === 0,
        () => new CliAuditRegression(),
      ),
    );
    yield* reporting;
  });
  return comparing.pipe(Effect.withSpan('zloz.cli.compareRelationships'));
}
function executeReviewPacket(
  input: string,
  baselineId: string,
  edition: Option.Option<string>,
  rules: Option.Option<string>,
  direction: MermaidDirection,
  lossPolicy: MermaidLossPolicy,
) {
  const creating = Effect.gen(function* () {
    const readingRules = Option.match(rules, {
      onNone: () => Effect.succeed<ZlozEventStormingRelationshipOptions>({}),
      onSome: readAuditRules('review-packet'),
    });
    const options = yield* readingRules;
    const document = yield* readForOperation('review-packet', input);
    const model = yield* requireModel(document, input, 'review-packet');
    const selection = Option.match(edition, {
      onNone: () => ({ baselineId }),
      onSome: (selectedId) => ({ baselineId, selectedId }),
    });
    const result = createReviewPacket(model, selection, {
      direction,
      lossPolicy,
      rules: options.rules,
    });
    const response = Match.value(result).pipe(
      Match.when(
        { status: 'created' },
        ({ value, diagnostics }): CliResponse => ({
          protocol: cliProtocol,
          operation: 'review-packet',
          status: 'created',
          scope: 'selected-snapshots',
          data: value,
          diagnostics,
        }),
      ),
      Match.orElse(
        ({ diagnostics }): CliResponse => ({
          protocol: cliProtocol,
          operation: 'review-packet',
          status: 'rejected',
          diagnostics,
        }),
      ),
    );
    yield* writeResponse(response);
    const finishing = Match.value(result).pipe(
      Match.when({ status: 'created' }, ({ value }) => Result.succeed(value)),
      Match.when({ status: 'rejected', reason: 'input' }, () =>
        Result.fail(new CliReviewInputRejected()),
      ),
      Match.orElse(() => Result.fail(new CliConversionRejected())),
    );
    yield* Effect.fromResult(finishing);
  });
  return creating.pipe(Effect.withSpan('zloz.cli.createReviewPacket'));
}
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
const rules = Flag.String('rules').pipe(
  Flag.optional,
  Flag.withDescription(
    'Optional version-one data-only rule catalogue file (1 MiB maximum). Stdin remains reserved for the model.',
  ),
);
const auditCommand = Command.make('audit', { input, rules }, (config) =>
  executeAudit(config.input, config.rules),
).pipe(
  Command.withDescription(
    'Read-only causal relationship audit with per-edge JSON results and semantic diagnostics.',
  ),
);
const dddAuditCommand = Command.make('audit', { input, rules }, (config) =>
  executeDddAudit(config.input, config.rules),
).pipe(
  Command.withDescription(
    'Audit declared DDD relationships under an explicit convention; exit 1 for incompatibility, 2 for invalid input.',
  ),
);
const dddCommand = Command.make('ddd').pipe(
  Command.withDescription('Read-only DDD convention tools; no inferred meaning or graph changes.'),
  Command.withSubcommands([dddAuditCommand]),
);
const baseline = Flag.String('baseline').pipe(
  Flag.withDescription('Required baseline edition ID owned by the input model.'),
);
const edition = Flag.String('edition').pipe(
  Flag.optional,
  Flag.withDescription('Target edition ID; omit to compare the current graph.'),
);
const compareCommand = Command.make('compare', { input, rules, baseline, edition }, (config) =>
  executeComparison(config.input, config.baseline, config.edition, config.rules),
).pipe(
  Command.withDescription(
    'Compare causal findings against an explicit baseline; exit 1 only for newly introduced findings.',
  ),
);
const relationshipsCommand = Command.make('relationships').pipe(
  Command.withDescription('Event-storming causal relationship tools.'),
  Command.withSubcommands([auditCommand, compareCommand]),
);
const packetCommand = Command.make(
  'packet',
  { input, rules, baseline, edition, direction, lossPolicy },
  (config) =>
    executeReviewPacket(
      config.input,
      config.baseline,
      config.edition,
      config.rules,
      config.direction,
      config.lossPolicy,
    ),
).pipe(
  Command.withDescription(
    'Create a portable selected-snapshot review packet with audit findings and loss-aware Mermaid projections.',
  ),
);

type ReviewReadOperation = Extract<CliOperation, 'review-validate' | 'review-inspect'>;
function reviewInputError(
  input: string,
  result: Extract<ZlozReviewPacketParseResult, { status: 'rejected' }>,
) {
  const dimension = Match.value(result.code).pipe(
    Match.when('invalid-json', () => 'syntax' as const),
    Match.when('limit-exceeded', () => 'syntax' as const),
    Match.when('unsupported-format', () => 'identity' as const),
    Match.when('unsupported-version', () => 'identity' as const),
    Match.orElse(() => 'semantics' as const),
  );
  return new CliInputError({
    code: result.code,
    message: result.reason,
    path: result.path,
    subject: input,
    dimension,
  });
}
function decodeReviewText(input: string, text: string) {
  return Match.value(parseReviewPacket(text)).pipe(
    Match.when({ status: 'parsed' }, (result) => Result.succeed(result.value)),
    Match.when({ status: 'rejected' }, (result) => Result.fail(reviewInputError(input, result))),
    Match.exhaustive,
  );
}
function readReviewPacket(operation: ReviewReadOperation, input: string) {
  return readTextInput(input).pipe(
    Effect.flatMap((text) => Effect.fromResult(decodeReviewText(input, text))),
    Effect.catchTag('CliInputError', (error) => rejectInput(operation, error)),
  );
}
function reviewReadResponse(operation: ReviewReadOperation, packet: ZlozReviewPacket): CliResponse {
  return Match.value(operation).pipe(
    Match.when(
      'review-inspect',
      (): CliResponse => ({
        protocol: cliProtocol,
        operation: 'review-inspect',
        status: 'inspected',
        scope: packet.scope,
        data: packet,
        diagnostics: packet.diagnostics,
      }),
    ),
    Match.when(
      'review-validate',
      (): CliResponse => ({
        protocol: cliProtocol,
        operation: 'review-validate',
        status: 'valid',
        summary: {
          model: packet.model,
          baseline: {
            source: packet.baseline.source,
            nodes: packet.baseline.snapshot.graph.nodes.length,
            edges: packet.baseline.snapshot.graph.edges.length,
          },
          selected: {
            source: packet.selected.source,
            nodes: packet.selected.snapshot.graph.nodes.length,
            edges: packet.selected.snapshot.graph.edges.length,
          },
          audit: { status: packet.comparison.status, summary: packet.comparison.summary },
        },
        diagnostics: packet.diagnostics,
      }),
    ),
    Match.exhaustive,
  );
}
function executeReviewRead(operation: ReviewReadOperation, input: string) {
  return readReviewPacket(operation, input).pipe(
    Effect.map((packet) => reviewReadResponse(operation, packet)),
    Effect.flatMap(writeResponse),
    Effect.asVoid,
    Effect.withSpan('zloz.cli.reviewRead'),
  );
}
const packetValidateCommand = Command.make('validate', { input }, (config) =>
  executeReviewRead('review-validate', config.input),
).pipe(
  Command.withDescription(
    'Validate a portable review packet; findings remain data and do not change validity exit status.',
  ),
);
const packetInspectCommand = Command.make('inspect', { input }, (config) =>
  executeReviewRead('review-inspect', config.input),
).pipe(
  Command.withDescription(
    'Inspect a strictly validated review packet as read-only JSON; never imports or executes its contents.',
  ),
);
const reviewCommand = Command.make('review').pipe(
  Command.withDescription('Portable architecture review artifacts.'),
  Command.withSubcommands([packetCommand, packetValidateCommand, packetInspectCommand]),
);
function decodePatchProposal(input: string, text: string) {
  return Match.value(parseModellingPatch(text)).pipe(
    Match.when({ status: 'parsed' }, (result) => Result.succeed(result.value)),
    Match.when({ status: 'rejected' }, (result) =>
      Result.fail(
        new CliInputError({
          code: result.code,
          message: result.reason,
          path: result.path,
          dimension: 'syntax',
          subject: input,
        }),
      ),
    ),
    Match.exhaustive,
  );
}
function readPatchProposal(input: string) {
  return readTextInput(input).pipe(
    Effect.flatMap((text) => Effect.fromResult(decodePatchProposal(input, text))),
    Effect.catchTag('CliInputError', (error) => rejectInput('patch-dry-run', error)),
  );
}
const patchDryRunCommand = Command.make(
  'dry-run',
  {
    input,
    source: Flag.String('source').pipe(
      Flag.withDescription('Separate canonical model document, or - for stdin.'),
    ),
    session: Flag.String('session').pipe(
      Flag.withDescription('Current host model/editor incarnation ID.'),
    ),
    revision: Flag.Int('revision').pipe(Flag.withDescription('Current monotonic editor revision.')),
  },
  (config) =>
    Effect.gen(function* () {
      if (
        (config.input === '-' && config.source === '-') ||
        !config.session.trim() ||
        !Number.isSafeInteger(config.revision) ||
        config.revision < 0
      )
        return yield* rejectInput(
          'patch-dry-run',
          new CliInputError({
            code: 'invalid-document',
            message:
              'Supply one stdin stream at most, a nonblank session and a nonnegative safe revision.',
            dimension: 'identity',
            subject: config.source,
          }),
        );
      const source = yield* readForOperation('patch-dry-run', config.source);
      if (source.kind !== 'model')
        return yield* rejectInput(
          'patch-dry-run',
          new CliInputError({
            code: 'model-required',
            message: 'Patch dry run requires a separately supplied canonical model document.',
            dimension: 'identity',
            subject: config.source,
          }),
        );
      const patch = yield* readPatchProposal(config.input);
      const preview = dryRunModellingPatch(
        {
          modelId: source.document.id,
          sessionId: config.session,
          revision: config.revision,
          graph: source.document.snapshot.graph,
        },
        patch,
      );
      const response: CliResponse = {
        protocol: cliProtocol,
        operation: 'patch-dry-run',
        status: 'reviewed',
        data: preview,
        diagnostics: preview.findings.flatMap((f) =>
          f.severity === 'info'
            ? []
            : [
                {
                  code: f.code,
                  message: f.message,
                  path: f.path,
                  subject: f.operationId ?? source.document.id,
                  dimension: 'semantics' as const,
                  severity: f.severity === 'error' ? ('error' as const) : ('loss' as const),
                },
              ],
        ),
      };
      yield* writeResponse(response);
      if (preview.type !== 'reviewable') return yield* Effect.fail(new CliPatchRejected());
    }),
).pipe(
  Command.withDescription(
    'Strictly decode a patch and review against separate current source. No mutation or Apply.',
  ),
);
const patchCommand = Command.make('patch').pipe(Command.withSubcommands([patchDryRunCommand]));
export const zlozCommand = Command.make('zloz').pipe(
  Command.withDescription(
    'Compose systems. Connect ideas. Validate and audit Zloz models; export Mermaid as JSON.',
  ),
  Command.withSubcommands([
    validate,
    mermaidCommand,
    relationshipsCommand,
    dddCommand,
    reviewCommand,
    patchCommand,
  ]),
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
