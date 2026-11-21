import type { ZlozGraph, ZlozGroupDocumentV3 } from '@opsydyn/foldkit-zloz';

type Endpoint = ZlozGraph['edges'][number]['source'];

interface Diagnostic {
  readonly severity: 'error' | 'loss';
  readonly code: string;
  readonly subject: string | null;
  readonly message: string;
}

type ExportResult =
  | { readonly status: 'rejected'; readonly diagnostics: readonly Diagnostic[] }
  | {
      readonly status: 'converted';
      readonly value: {
        readonly protocol: 'foldkit-zloz-likec4/v1';
        readonly source: string;
        readonly identity: {
          readonly connectionMode: 'strict' | 'loose';
          readonly groupPorts: boolean;
          readonly elements: readonly { readonly id: string; readonly fqn: string }[];
          readonly relationships: readonly {
            readonly id: string;
            readonly source: Endpoint;
            readonly target: Endpoint;
            readonly title: string;
          }[];
        };
        readonly diagnostics: readonly Diagnostic[];
      };
    };

export function exportLikeC4(
  input: ZlozGroupDocumentV3,
  options?: { readonly lossPolicy?: 'reject' | 'report' },
): Promise<ExportResult>;
