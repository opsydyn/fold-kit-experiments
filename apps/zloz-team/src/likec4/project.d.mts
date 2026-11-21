import type { ZlozGroupDocumentV3 } from '@opsydyn/foldkit-zloz';

export interface ImportFinding {
  readonly code: string;
  readonly subject: string | null;
  readonly message: string;
  readonly severity: 'error' | 'loss' | 'info';
}

export function importLikeC4(
  text: string,
  viewId: string,
):
  | { readonly status: 'rejected'; readonly diagnostics: readonly ImportFinding[] }
  | {
      readonly status: 'converted';
      readonly value: {
        readonly document: ZlozGroupDocumentV3;
        readonly diagnostics: readonly ImportFinding[];
      };
    };

export function listLikeC4Views(text: string): readonly string[];
