import type {
  ZlozPortableCompatibilityV2,
  ZlozPortableCompatibilityV3,
  ZlozModellingPatchPreviewV2,
  ZlozRelationshipAuditComparisonV2,
  ZlozDddRelationshipAuditComparisonV2,
  ZlozConnectionMode,
  ZlozDddRelationshipAudit,
  ZlozDddRelationshipAuditComparison,
  ZlozEventStormingRelationshipAudit,
  ZlozRelationshipAuditComparison,
  ZlozModellingPatchPreview,
  ZlozEventStormingC4Conversion,
  ZlozEventStormingC4ConversionV2,
  ZlozHistoryModeChangeV2,
  ZlozEventStormingC4ConversionDisclosure,
  ZlozHistoryComparison,
} from '@opsydyn/foldkit-zloz';
import type {
  MermaidBundle,
  MermaidBundleV2,
  ZlozReviewPacket,
  ZlozReviewPacketV2,
  ZlozReviewPacketDiagnostic,
  ZlozReviewPacketParseResult,
} from '@opsydyn/foldkit-zloz-mermaid';
import { Data, Runtime, Schema } from 'effect';

import type { CliNativeReceiptInspection } from './native-receipts';

export const cliProtocol = 'foldkit-zloz-cli/v1';
export type CliOperation =
  | 'ddd-receipt-inspect'
  | 'patch-receipt-inspect'
  | 'compatibility-inspect'
  | 'validate'
  | 'c4-receipt-inspect'
  | 'mermaid-export'
  | 'ddd-audit'
  | 'ddd-compare'
  | 'relationships-audit'
  | 'relationships-compare'
  | 'review-packet'
  | 'review-validate'
  | 'review-inspect'
  | 'patch-dry-run'
  | 'invocation';
export const CliDiagnostic = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  subject: Schema.NullOr(Schema.String),
  severity: Schema.Literals(['error', 'loss']),
  dimension: Schema.Literals(['syntax', 'semantics', 'identity', 'layout', 'io']),
  /** JSON Pointer from strict document decoding, including empty root. */
  path: Schema.optionalKey(Schema.String),
  /** Present for packet conversion diagnostics; other commands retain their existing shape. */
  side: Schema.optionalKey(Schema.Literals(['packet', 'baseline', 'selected'])),
});
export type CliDiagnostic = typeof CliDiagnostic.Type;
export type CliReviewPacketSummary = Readonly<{
  model: ZlozReviewPacket['model'];
  baseline: Readonly<{
    source: ZlozReviewPacket['baseline']['source'];
    nodes: number;
    edges: number;
  }>;
  selected: Readonly<{
    source: ZlozReviewPacket['selected']['source'];
    nodes: number;
    edges: number;
  }>;
  audit: Pick<ZlozRelationshipAuditComparison, 'status' | 'summary'>;
}>;
/** Read-only report; recorded acceptance is not current consent or verified authorship. */
export type CliC4ReceiptInspection = Readonly<{
  format: ZlozEventStormingC4Conversion['format'];
  version: 1;
  authority: 'read-only-evidence';
  provenance: ZlozEventStormingC4Conversion['source'];
  target: ZlozEventStormingC4Conversion['document'];
  choices: ZlozEventStormingC4Conversion['options'];
  changes: Pick<ZlozHistoryComparison, 'nodes' | 'edges'>;
  losses: readonly ZlozEventStormingC4ConversionDisclosure[];
  lossesAccepted: true;
}>;
export type CliC4ReceiptInspectionV2 = Omit<
  CliC4ReceiptInspection,
  'version' | 'provenance' | 'target' | 'changes'
> &
  Readonly<{
    version: 2;
    provenance: ZlozEventStormingC4ConversionV2['source'];
    target: ZlozEventStormingC4ConversionV2['document'];
    changes: CliC4ReceiptInspection['changes'] & Readonly<{ modeChange: ZlozHistoryModeChangeV2 }>;
  }>;
export type CliResponse =
  | CliNativeReceiptInspection
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'compatibility-inspect';
      status: 'inspected';
      data: ZlozPortableCompatibilityV2 | ZlozPortableCompatibilityV3;
      diagnostics: readonly CliDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'c4-receipt-inspect';
      status: 'inspected';
      scope: 'recorded-conversion';
      data: CliC4ReceiptInspection | CliC4ReceiptInspectionV2;
      diagnostics: readonly CliDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'ddd-audit';
      status: 'audited';
      scope: 'current-graph';
      documentVersion?: 2;
      connectionMode?: ZlozConnectionMode;
      modelId: string | null;
      conventions: Readonly<{ source: 'builtin' | 'file'; input: string | null }>;
      data: ZlozDddRelationshipAudit;
      diagnostics: readonly CliDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'ddd-compare';
      status: 'compared';
      scope: 'model-editions';
      conventions: Readonly<{ source: 'builtin' | 'file'; input: string | null }>;
      data: ZlozDddRelationshipAuditComparison | ZlozDddRelationshipAuditComparisonV2;
      /** Introduced findings only; persisting incompatibility remains in data. */
      diagnostics: readonly CliDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'patch-dry-run';
      status: 'reviewed';
      data: ZlozModellingPatchPreview | ZlozModellingPatchPreviewV2;
      diagnostics: readonly CliDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'review-validate';
      status: 'valid';
      summary: CliReviewPacketSummary;
      diagnostics: readonly ZlozReviewPacketDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'review-inspect';
      status: 'inspected';
      scope: 'selected-snapshots';
      data: ZlozReviewPacket | ZlozReviewPacketV2;
      diagnostics: readonly ZlozReviewPacketDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'validate';
      status: 'valid';
      summary: Readonly<{ nodes: number; edges: number }>;
      documentVersion?: 2;
      connectionMode?: ZlozConnectionMode;
      model?: Readonly<{
        id: string;
        name: string;
        editions: number;
        origin: Readonly<{ modelId: string; editionId: string }> | null;
      }>;
      diagnostics: readonly CliDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'review-packet';
      status: 'created';
      scope: 'selected-snapshots';
      data: ZlozReviewPacket | ZlozReviewPacketV2;
      diagnostics: readonly ZlozReviewPacketDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'mermaid-export';
      status: 'converted';
      data: MermaidBundle | MermaidBundleV2;
      diagnostics: readonly CliDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'relationships-audit';
      status: 'audited';
      scope: 'current-graph';
      documentVersion?: 2;
      connectionMode?: ZlozConnectionMode;
      modelId: string | null;
      conventions: Readonly<{ source: 'builtin' | 'file'; input: string | null }>;
      data: ZlozEventStormingRelationshipAudit;
      diagnostics: readonly CliDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'relationships-compare';
      status: 'compared';
      scope: 'model-editions';
      conventions: Readonly<{ source: 'builtin' | 'file'; input: string | null }>;
      data: ZlozRelationshipAuditComparison | ZlozRelationshipAuditComparisonV2;
      /** Newly introduced findings only; persisting findings remain in data. */
      diagnostics: readonly CliDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: CliOperation;
      status: 'rejected';
      diagnostics: readonly CliDiagnostic[];
    }>;

export class CliInputError extends Data.TaggedError('CliInputError')<{
  readonly code:
    | 'model-projection-required'
    | 'input-required'
    | 'input-unavailable'
    | 'input-limit'
    | 'invalid-utf8'
    | 'invalid-json'
    | 'invalid-document'
    | 'invalid-rules'
    | 'model-required'
    | 'invalid-patch'
    | 'invalid-c4-receipt'
    | 'invalid-receipt'
    | 'unknown-baseline'
    | 'unknown-edition'
    | Extract<ZlozReviewPacketParseResult, { status: 'rejected' }>['code'];
  readonly message: string;
  readonly dimension: CliDiagnostic['dimension'];
  readonly subject: string;
  readonly path?: string;
}> {
  readonly [Runtime.errorExitCode] = 2;
  readonly [Runtime.errorReported] = false;
}
export class CliOutputError extends Data.TaggedError('CliOutputError') {
  readonly [Runtime.errorExitCode] = 2;
  readonly [Runtime.errorReported] = false;
}
export class CliConversionRejected extends Data.TaggedError('CliConversionRejected') {
  readonly [Runtime.errorExitCode] = 1;
  readonly [Runtime.errorReported] = false;
}
export class CliAuditIncompatible extends Data.TaggedError('CliAuditIncompatible') {
  readonly [Runtime.errorExitCode] = 1;
  readonly [Runtime.errorReported] = false;
}
export class CliAuditRegression extends Data.TaggedError('CliAuditRegression') {
  readonly [Runtime.errorExitCode] = 1;
  readonly [Runtime.errorReported] = false;
}
export class CliReviewInputRejected extends Data.TaggedError('CliReviewInputRejected') {
  readonly [Runtime.errorExitCode] = 2;
  readonly [Runtime.errorReported] = false;
}
export class CliInvocationRejected extends Data.TaggedError('CliInvocationRejected') {
  readonly [Runtime.errorExitCode] = 2;
  readonly [Runtime.errorReported] = false;
}

/** JSON framing belongs at the output boundary, not in the graph model. */
export const encodeResponse = Schema.encodeUnknownSync(Schema.fromJsonString(Schema.Json));

export class CliPatchRejected extends Data.TaggedError('CliPatchRejected') {
  readonly [Runtime.errorExitCode] = 1;
  readonly [Runtime.errorReported] = false;
}

/** A syntactically readable receipt belongs to a different format/version contract. */
export class CliC4ReceiptIncompatible extends Data.TaggedError('CliC4ReceiptIncompatible')<{
  readonly message: string;
  readonly subject: string;
  readonly path?: string;
}> {
  readonly code = 'incompatible-c4-receipt';
  readonly dimension = 'identity';
  readonly [Runtime.errorExitCode] = 1;
  readonly [Runtime.errorReported] = false;
}

/** A valid input whose native adapter version is unavailable, distinct from invalid input (exit 2). */
export class CliAdapterIncompatible extends Data.TaggedError('CliAdapterIncompatible')<{
  readonly subject: string;
}> {
  readonly code = 'adapter-version-required';
  readonly message =
    'This operation requires a v1 document. Native v2 support requires a versioned adapter contract; inspect compatibility before an explicit downgrade.';
  readonly dimension = 'semantics';
  readonly path = undefined;
  readonly [Runtime.errorExitCode] = 1;
  readonly [Runtime.errorReported] = false;
}

export class CliReceiptIncompatible extends Data.TaggedError('CliReceiptIncompatible')<{
  readonly subject: string;
}> {
  readonly code = 'incompatible-receipt';
  readonly message = 'This receipt format or version is unsupported by the selected inspector.';
  readonly dimension = 'identity';
  readonly [Runtime.errorExitCode] = 1;
  readonly [Runtime.errorReported] = false;
}
