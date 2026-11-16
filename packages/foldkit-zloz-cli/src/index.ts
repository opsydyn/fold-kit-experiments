/**
 * Effect command tree for the standalone Zloz CLI. Importing never starts a process.
 * @module CLI
 */
import {
  auditGroupDddRelationshipsV3,
  auditGroupEventStormingRelationshipsV3,
  compareModelDddRelationshipsV3,
  compareModelEventStormingRelationshipsV3,
  parseModellingPatchV3,
  dryRunModellingPatchV3,
  type ZlozModelDocumentV3,
  assessPortableCompatibilityV2,
  assessPortableCompatibilityV3,
  parseModelDocumentV3,
  parseModellingPatchV2,
  dryRunModellingPatchV2,
  auditConnectionDddRelationships,
  auditConnectionEventStormingRelationships,
  compareModelDddRelationshipsV2,
  compareModelEventStormingRelationshipsV2,
  type ZlozModelDocument,
  type ZlozModelDocumentV2,
  parseModellingPatch,
  dryRunModellingPatch,
  auditDddRelationships,
  compareModelDddRelationships,
  auditEventStormingRelationships,
  compareModelEventStormingRelationships,
  type ZlozDddRelationshipOptions,
  type ZlozGraph,
  type ZlozSnapshot,
  type ZlozEventStormingRelationshipOptions,
} from '@opsydyn/foldkit-zloz';
import {
  exportGroupMermaidV3,
  createReviewPacketV3,
  parseReviewPacketV3,
  type ZlozReviewPacketV3,
  type ZlozReviewPacketResultV3,
  exportMermaid,
  exportConnectionMermaid,
  createReviewPacket,
  createReviewPacketV2,
  parseReviewPacketV2,
  type ZlozReviewPacketV2,
  type ZlozReviewPacketResultV2,
  type ZlozReviewPacketResult,
  parseReviewPacket,
  type ZlozReviewPacket,
  type ZlozReviewPacketParseResult,
  type MermaidDirection,
  type MermaidLossPolicy,
} from '@opsydyn/foldkit-zloz-mermaid';
import { Console, Effect, Match, Option, Result, Schema, Stdio } from 'effect';
import { CliError, CliOutput, Command, Flag } from 'effect/cli';

import manifest from '../package.json';
import { inspectC4Receipt, inspectC4ReceiptV2, inspectC4ReceiptV3 } from './c4-receipt';
import { readDddRelationshipRules } from './ddd-relationship-rules';
import {
  inputByteLimit,
  readPortableDocument,
  readTextInput,
  readReceiptInput,
  writeResponse,
  type CliPortableDocument,
} from './io';
import { inspectNativeReceipt } from './native-receipts';
import {
  cliProtocol,
  CliInputError,
  CliAdapterIncompatible,
  CliC4ReceiptIncompatible,
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
export { inputByteLimit, readGraph, readDocument, readPortableDocument } from './io';
export type { CliDocument, CliPortableDocument } from './io';
export {
  cliProtocol,
  CliDiagnostic,
  CliInputError,
  CliAdapterIncompatible,
  CliReceiptIncompatible,
  CliC4ReceiptIncompatible,
  CliOutputError,
  CliConversionRejected,
  CliAuditIncompatible,
  CliAuditRegression,
  CliReviewInputRejected,
  CliPatchRejected,
  CliInvocationRejected,
} from './protocol';
export type {
  CliOperation,
  CliResponse,
  CliReviewPacketSummary,
  CliC4ReceiptInspection,
  CliC4ReceiptInspectionV2,
} from './protocol';

type Operation = Exclude<CliOperation, 'invocation'>;
function rejectInput<E extends CliInputError | CliC4ReceiptIncompatible | CliAdapterIncompatible>(
  operation: Operation,
  error: E,
) {
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
  return readPortableDocument(input).pipe(
    Effect.catchTag(['CliInputError'], (error) => rejectInput(operation, error)),
  );
}
function requireModel(document: CliPortableDocument, input: string, operation: Operation) {
  const result = Match.value(document).pipe(
    Match.when(isModel, ({ document }) => Result.succeed(document)),
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
  project: (document: CliPortableDocument) => CliResponse,
) {
  return Effect.gen(function* () {
    const document = yield* readPortableDocument(input).pipe(
      Effect.catchTag('CliInputError', (error) => rejectInput(operation, error)),
    );
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
const isModel = (
  value: CliPortableDocument,
): value is Extract<CliPortableDocument, { kind: 'model' | 'model-v2' | 'model-v3' }> =>
  value.kind === 'model' || value.kind === 'model-v2' || value.kind === 'model-v3';
const isCanonicalV2Model = (
  model: ZlozModelDocument | ZlozModelDocumentV2 | ZlozModelDocumentV3,
): model is ZlozModelDocumentV2 =>
  'connectionMode' in model.snapshot && !('capabilities' in model.snapshot);
const isCanonicalV3Model = (
  model: ZlozModelDocument | ZlozModelDocumentV2 | ZlozModelDocumentV3,
): model is ZlozModelDocumentV3 => 'capabilities' in model.snapshot;
const graphOf = (document: CliPortableDocument): ZlozGraph =>
  Match.value(document).pipe(
    Match.when(isModel, (value) => value.document.snapshot.graph),
    Match.orElse((value) => value.snapshot.graph),
  );
const portableFields = (document: CliPortableDocument) =>
  Match.value(document).pipe(
    Match.when({ kind: 'model-v3' }, ({ document }) => ({
      connectionMode: document.snapshot.connectionMode,
      documentVersion: 3 as const,
    })),
    Match.when({ kind: 'group-v3' }, ({ snapshot }) => ({
      connectionMode: snapshot.connectionMode,
      documentVersion: 3 as const,
    })),
    Match.when({ kind: 'model-v2' }, ({ document }) => ({
      connectionMode: document.snapshot.connectionMode,
      documentVersion: 2 as const,
    })),
    Match.when({ kind: 'connection-v2' }, ({ snapshot }) => ({
      connectionMode: snapshot.connectionMode,
      documentVersion: 2 as const,
    })),
    Match.orElse(() => ({})),
  );
const summarize = (document: CliPortableDocument): CliResponse => {
  const graph = graphOf(document);
  const versionFields = portableFields(document);
  const response: Extract<CliResponse, { status: 'valid' }> = {
    protocol: cliProtocol,
    operation: 'validate' as const,
    status: 'valid' as const,
    summary: { nodes: graph.nodes.length, edges: graph.edges.length },
    diagnostics: [],
    ...versionFields,
  };
  return Match.value(document).pipe(
    Match.when(isModel, ({ document }) => ({
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
const metadataLosses = (document: CliPortableDocument): readonly CliDiagnostic[] =>
  Match.value(document).pipe(
    Match.when(isModel, ({ document }) => [
      {
        code: 'model-metadata-omitted',
        severity: 'loss' as const,
        dimension: 'identity' as const,
        subject: document.id,
        message:
          'Mermaid projects only the current graph; model identity, editions, lineage and capture camera are omitted. Keep model JSON as the authoritative document.',
      },
    ]),
    Match.when({ kind: 'connection-v2' }, () => []),
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
  (document: CliPortableDocument): CliResponse => {
    const losses = metadataLosses(document);
    const result = Match.value(document).pipe(
      Match.when({ kind: 'model-v3' }, ({ document }) =>
        exportGroupMermaidV3(document.snapshot, { direction, lossPolicy }),
      ),
      Match.when({ kind: 'group-v3' }, ({ snapshot }) =>
        exportGroupMermaidV3(snapshot, { direction, lossPolicy }),
      ),
      Match.when({ kind: 'model-v2' }, ({ document }) =>
        exportConnectionMermaid(document.snapshot, { direction, lossPolicy }),
      ),
      Match.when({ kind: 'connection-v2' }, ({ snapshot }) =>
        exportConnectionMermaid(snapshot, { direction, lossPolicy }),
      ),
      Match.orElse((value) => exportMermaid(graphOf(value), { direction, lossPolicy })),
    );
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
    const data = Match.value(document).pipe(
      Match.when({ kind: 'model-v3' }, ({ document }) =>
        auditGroupEventStormingRelationshipsV3(document.snapshot, options),
      ),
      Match.when({ kind: 'group-v3' }, ({ snapshot }) =>
        auditGroupEventStormingRelationshipsV3(snapshot, options),
      ),
      Match.when({ kind: 'model-v2' }, ({ document }) =>
        auditConnectionEventStormingRelationships(document.snapshot, options),
      ),
      Match.when({ kind: 'connection-v2' }, ({ snapshot }) =>
        auditConnectionEventStormingRelationships(snapshot, options),
      ),
      Match.orElse((value) => auditEventStormingRelationships(graphOf(value), options)),
    );
    const modelId = Match.value(document).pipe(
      Match.when(isModel, ({ document }) => document.id),
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
      ...portableFields(document),
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
const readDddRules = (operation: 'ddd-audit' | 'ddd-compare') => (input: string) =>
  readDddRelationshipRules(input).pipe(
    Effect.catchTag('CliInputError', (error) => rejectInput(operation, error)),
  );
/** ADR 0079: a distinct operation preserves causal command and convention-file compatibility. */
function executeDddAudit(input: string, rules: Option.Option<string>) {
  const auditing = Effect.gen(function* () {
    const readingRules = Option.match(rules, {
      onNone: () => Effect.succeed<ZlozDddRelationshipOptions>({}),
      onSome: readDddRules('ddd-audit'),
    });
    const options = yield* readingRules;
    const document = yield* readForOperation('ddd-audit', input);
    const data = Match.value(document).pipe(
      Match.when({ kind: 'model-v3' }, ({ document }) =>
        auditGroupDddRelationshipsV3(document.snapshot, options),
      ),
      Match.when({ kind: 'group-v3' }, ({ snapshot }) =>
        auditGroupDddRelationshipsV3(snapshot, options),
      ),
      Match.when({ kind: 'model-v2' }, ({ document }) =>
        auditConnectionDddRelationships(document.snapshot, options),
      ),
      Match.when({ kind: 'connection-v2' }, ({ snapshot }) =>
        auditConnectionDddRelationships(snapshot, options),
      ),
      Match.orElse((value) => auditDddRelationships(graphOf(value), options)),
    );
    const modelId = Match.value(document).pipe(
      Match.when(isModel, ({ document }) => document.id),
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
      ...portableFields(document),
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
    const result = isCanonicalV3Model(model)
      ? compareModelEventStormingRelationshipsV3(model, selection, options)
      : isCanonicalV2Model(model)
        ? compareModelEventStormingRelationshipsV2(model, selection, options)
        : compareModelEventStormingRelationships(model, selection, options);
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
    const response: Extract<
      CliResponse,
      { operation: 'relationships-compare'; status: 'compared' }
    > = {
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
function executeDddComparison(
  input: string,
  baselineId: string,
  edition: Option.Option<string>,
  rules: Option.Option<string>,
) {
  const comparing = Effect.gen(function* () {
    const readingRules = Option.match(rules, {
      onNone: () => Effect.succeed<ZlozDddRelationshipOptions>({}),
      onSome: readDddRules('ddd-compare'),
    });
    const options = yield* readingRules;
    const document = yield* readForOperation('ddd-compare', input);
    const model = yield* requireModel(document, input, 'ddd-compare');
    const selection = Option.match(edition, {
      onNone: () => ({ baselineId }),
      onSome: (selectedId) => ({ baselineId, selectedId }),
    });
    const result = isCanonicalV3Model(model)
      ? compareModelDddRelationshipsV3(model, selection, options)
      : isCanonicalV2Model(model)
        ? compareModelDddRelationshipsV2(model, selection, options)
        : compareModelDddRelationships(model, selection, options);
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
      Effect.catchTag('CliInputError', (error) => rejectInput('ddd-compare', error)),
    );
    const data = yield* selectingComparison;
    const conventions = Option.match(rules, {
      onNone: () => ({ source: 'builtin' as const, input: null }),
      onSome: (input) => ({ source: 'file' as const, input }),
    });
    const response: Extract<CliResponse, { operation: 'ddd-compare'; status: 'compared' }> = {
      protocol: cliProtocol,
      operation: 'ddd-compare',
      status: 'compared',
      scope: 'model-editions',
      conventions,
      data,
      diagnostics: data.introduced.map((entry) => ({
        code: `ddd-relationship-${entry.code}`,
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
  return comparing.pipe(Effect.withSpan('zloz.cli.compareDddRelationships'));
}
function boundNativePacket(
  result: ZlozReviewPacketResult | ZlozReviewPacketResultV2 | ZlozReviewPacketResultV3,
): ZlozReviewPacketResult | ZlozReviewPacketResultV2 | ZlozReviewPacketResultV3 {
  if (
    result.status === 'created' &&
    result.value.version >= 2 &&
    new TextEncoder().encode(JSON.stringify(result.value)).byteLength > inputByteLimit
  )
    return {
      status: 'rejected',
      reason: 'projection',
      diagnostics: [
        {
          side: 'packet',
          code: 'packet-limit',
          severity: 'error',
          dimension: 'syntax',
          subject: null,
          message: 'Generated v2 packet exceeds the CLI reopening byte limit.',
        },
      ],
    };
  return result;
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
    const creationOptions = { direction, lossPolicy, rules: options.rules };
    const created = isCanonicalV3Model(model)
      ? createReviewPacketV3(model, selection, creationOptions)
      : isCanonicalV2Model(model)
        ? createReviewPacketV2(model, selection, creationOptions)
        : createReviewPacket(model, selection, creationOptions);
    const result = boundNativePacket(created);
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
    'Zloz document JSON file, or - for stdin (1 MiB maximum). Each operation declares supported versions.',
  ),
);
const compatibilityInspect = Command.make('inspect', { input }, (config) =>
  Effect.gen(function* () {
    const document = yield* readPortableDocument(config.input).pipe(
      Effect.catchTag('CliInputError', (error) => rejectInput('compatibility-inspect', error)),
    );
    const selection = Match.value(document).pipe(
      Match.when({ kind: 'model-v2' }, ({ document }) => Result.succeed(document)),
      Match.orElse(() =>
        Result.fail(
          new CliInputError({
            code: 'model-required',
            message:
              'Compatibility inspection requires a canonical v2 model, including editions and origin.',
            dimension: 'identity',
            subject: config.input,
          }),
        ),
      ),
    );
    const selectingModel = Effect.fromResult(selection).pipe(
      Effect.catchTag('CliInputError', (error) => rejectInput('compatibility-inspect', error)),
    );
    const model = yield* selectingModel;
    yield* writeResponse({
      protocol: cliProtocol,
      operation: 'compatibility-inspect',
      status: 'inspected',
      data: assessPortableCompatibilityV2(model),
      diagnostics: [],
    });
  }),
).pipe(
  Command.withDescription(
    'Read-only v2 model adapter capabilities and downgrade findings. No conversion or Apply.',
  ),
);
const compatibilityInspectV3 = Command.make('inspect-v3', { input }, (config) =>
  Effect.gen(function* () {
    const text = yield* readTextInput(config.input).pipe(
      Effect.catchTag('CliInputError', (error) => rejectInput('compatibility-inspect', error)),
    );
    const decoding = Effect.try({
      try: () => parseModelDocumentV3(text),
      catch: (cause) =>
        new CliInputError({
          code: 'invalid-document',
          message: String(cause),
          dimension: 'semantics',
          subject: config.input,
        }),
    }).pipe(
      Effect.catchTag('CliInputError', (error) => rejectInput('compatibility-inspect', error)),
    );
    const model = yield* decoding;
    yield* writeResponse({
      protocol: cliProtocol,
      operation: 'compatibility-inspect',
      status: 'inspected',
      data: assessPortableCompatibilityV3(model),
      diagnostics: [],
    });
  }),
).pipe(
  Command.withDescription(
    'Read-only canonical v3 capabilities, explicit adapter limits and downgrade findings. No conversion or Apply.',
  ),
);
const compatibilityCommand = Command.make('compatibility').pipe(
  Command.withSubcommands([compatibilityInspect, compatibilityInspectV3]),
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
    'Validate a canonical v1 or v2 Zloz document and report counts plus explicit v2 mode.',
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
const dddCompareCommand = Command.make('compare', { input, rules, baseline, edition }, (config) =>
  executeDddComparison(config.input, config.baseline, config.edition, config.rules),
).pipe(
  Command.withDescription(
    'Compare DDD findings against an explicit baseline; exit 1 only for newly introduced findings.',
  ),
);
const dddReceiptCommand = Command.make('receipt').pipe(
  Command.withSubcommands([
    Command.make('inspect', { input }, (config) =>
      inspectNativeReceipt('ddd-receipt-inspect', config.input),
    ),
  ]),
);
const dddCommand = Command.make('ddd').pipe(
  Command.withDescription('Read-only DDD convention tools; no inferred meaning or graph changes.'),
  Command.withSubcommands([dddAuditCommand, dddCompareCommand, dddReceiptCommand]),
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
  const legacy = parseReviewPacket(text);
  const intermediate =
    legacy.status === 'rejected' && legacy.code === 'unsupported-version'
      ? parseReviewPacketV2(text)
      : legacy;
  const decoded =
    intermediate.status === 'rejected' && intermediate.code === 'unsupported-version'
      ? parseReviewPacketV3(text)
      : intermediate;
  return Match.value(decoded).pipe(
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
function reviewReadResponse(
  operation: ReviewReadOperation,
  packet: ZlozReviewPacket | ZlozReviewPacketV2 | ZlozReviewPacketV3,
): CliResponse {
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
  const legacy = parseModellingPatch(text);
  const intermediate =
    legacy.status === 'rejected' && legacy.code === 'unsupported-version'
      ? parseModellingPatchV2(text)
      : legacy;
  const decoded =
    intermediate.status === 'rejected' && intermediate.code === 'unsupported-version'
      ? parseModellingPatchV3(text)
      : intermediate;
  return Match.value(decoded).pipe(
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
      if (!isModel(source))
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
      const preview = Match.value(source).pipe(
        Match.when({ kind: 'model-v3' }, ({ document }) =>
          dryRunModellingPatchV3(
            {
              ...document.snapshot,
              modelId: document.id,
              sessionId: config.session,
              revision: config.revision,
            },
            patch,
          ),
        ),
        Match.when({ kind: 'model-v2' }, ({ document }) =>
          dryRunModellingPatchV2(
            {
              modelId: document.id,
              sessionId: config.session,
              revision: config.revision,
              graph: document.snapshot.graph,
              connectionMode: document.snapshot.connectionMode,
            },
            patch,
          ),
        ),
        Match.orElse(({ document }) =>
          dryRunModellingPatch(
            {
              modelId: document.id,
              sessionId: config.session,
              revision: config.revision,
              graph: document.snapshot.graph,
            },
            patch,
          ),
        ),
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
const patchReceiptCommand = Command.make('receipt').pipe(
  Command.withSubcommands([
    Command.make('inspect', { input }, (config) =>
      inspectNativeReceipt('patch-receipt-inspect', config.input),
    ),
  ]),
);
const patchCommand = Command.make('patch').pipe(
  Command.withSubcommands([patchDryRunCommand, patchReceiptCommand]),
);
const c4ReceiptEnvelope = Schema.Struct({ format: Schema.String, version: Schema.Number });
function executeC4ReceiptInspection(input: string) {
  const inspecting = Effect.gen(function* () {
    const { text, value } = yield* readReceiptInput(input);
    if (
      Schema.is(c4ReceiptEnvelope)(value) &&
      (value.format !== 'foldkit-zloz-c4-conversion' ||
        (value.version !== 1 && value.version !== 2 && value.version !== 3))
    )
      return yield* Effect.fail(
        new CliC4ReceiptIncompatible({
          subject: input,
          message:
            'Expected a foldkit-zloz-c4-conversion v1 or v2 receipt; this format or version is unsupported.',
        }),
      );
    const response = yield* Effect.try({
      try: () =>
        Schema.is(Schema.Struct({ version: Schema.Literal(3) }))(value)
          ? inspectC4ReceiptV3(text)
          : Schema.is(Schema.Struct({ version: Schema.Literal(2) }))(value)
            ? inspectC4ReceiptV2(text)
            : inspectC4Receipt(text),
      catch: () =>
        new CliInputError({
          code: 'invalid-c4-receipt',
          dimension: 'semantics',
          subject: input,
          message:
            'C4 receipt validation failed. Source, choices, recorded acceptance and complete target must satisfy the declared conversion version.',
        }),
    });
    yield* writeResponse(response);
  });
  return inspecting.pipe(Effect.withSpan('zloz.cli.c4ReceiptInspect'));
}
const c4ReceiptInspect = Command.make('inspect', { input }, (config) =>
  executeC4ReceiptInspection(config.input).pipe(
    Effect.catchTag(['CliInputError', 'CliC4ReceiptIncompatible'], (error) =>
      rejectInput('c4-receipt-inspect', error),
    ),
  ),
).pipe(
  Command.withDescription(
    'Strict read-only C4 receipt inspection with provenance, changes and recorded loss findings.',
  ),
);
const c4Receipt = Command.make('receipt').pipe(Command.withSubcommands([c4ReceiptInspect]));
const c4Command = Command.make('c4').pipe(Command.withSubcommands([c4Receipt]));
export const zlozCommand = Command.make('zloz').pipe(
  Command.withDescription(
    'Compose systems. Connect ideas. Validate and audit Zloz models; export Mermaid as JSON.',
  ),
  Command.withSubcommands([
    validate,
    compatibilityCommand,
    mermaidCommand,
    relationshipsCommand,
    dddCommand,
    reviewCommand,
    patchCommand,
    c4Command,
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

export type { CliNativeReceiptInspection, CliNativeReceiptReview } from './native-receipts';
