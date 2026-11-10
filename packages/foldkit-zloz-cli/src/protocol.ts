import type {
  ZlozEventStormingRelationshipAudit,
  ZlozRelationshipAuditComparison,
} from '@opsydyn/foldkit-zloz';
import type {
  MermaidBundle,
  ZlozReviewPacket,
  ZlozReviewPacketDiagnostic,
} from '@opsydyn/foldkit-zloz-mermaid';
import { Data, Runtime, Schema } from 'effect';

export const cliProtocol = 'foldkit-zloz-cli/v1';
export type CliOperation =
  | 'validate'
  | 'mermaid-export'
  | 'relationships-audit'
  | 'relationships-compare'
  | 'review-packet'
  | 'invocation';
export const CliDiagnostic = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  subject: Schema.NullOr(Schema.String),
  severity: Schema.Literals(['error', 'loss']),
  dimension: Schema.Literals(['syntax', 'semantics', 'identity', 'layout', 'io']),
  /** Present for packet conversion diagnostics; other commands retain their existing shape. */
  side: Schema.optionalKey(Schema.Literals(['packet', 'baseline', 'selected'])),
});
export type CliDiagnostic = typeof CliDiagnostic.Type;
export type CliResponse =
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'validate';
      status: 'valid';
      summary: Readonly<{ nodes: number; edges: number }>;
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
      data: ZlozReviewPacket;
      diagnostics: readonly ZlozReviewPacketDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'mermaid-export';
      status: 'converted';
      data: MermaidBundle;
      diagnostics: readonly CliDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof cliProtocol;
      operation: 'relationships-audit';
      status: 'audited';
      scope: 'current-graph';
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
      data: ZlozRelationshipAuditComparison;
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
    | 'unknown-baseline'
    | 'unknown-edition';
  readonly message: string;
  readonly dimension: CliDiagnostic['dimension'];
  readonly subject: string;
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
