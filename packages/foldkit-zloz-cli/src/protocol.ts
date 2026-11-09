import type { MermaidBundle } from '@opsydyn/foldkit-zloz-mermaid';
import { Data, Runtime, Schema } from 'effect';

export const cliProtocol = 'foldkit-zloz-cli/v1';
export type CliOperation = 'validate' | 'mermaid-export' | 'invocation';
export const CliDiagnostic = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  subject: Schema.NullOr(Schema.String),
  severity: Schema.Literals(['error', 'loss']),
  dimension: Schema.Literals(['syntax', 'semantics', 'identity', 'layout', 'io']),
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
      operation: 'mermaid-export';
      status: 'converted';
      data: MermaidBundle;
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
    | 'invalid-document';
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
export class CliInvocationRejected extends Data.TaggedError('CliInvocationRejected') {
  readonly [Runtime.errorExitCode] = 2;
  readonly [Runtime.errorReported] = false;
}

/** JSON framing belongs at the output boundary, not in the graph model. */
export const encodeResponse = Schema.encodeUnknownSync(Schema.fromJsonString(Schema.Json));
