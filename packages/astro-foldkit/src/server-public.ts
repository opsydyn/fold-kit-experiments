import type { FoldkitPage, PageContext } from './types';

export type ResolvedPageDocument = {
  readonly title: string;
  readonly lang?: string;
  readonly dir?: string;
  readonly canonical?: string;
  readonly ogUrl?: string;
};

export async function resolvePageDocument<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Flags extends Record<string, unknown> = Record<string, unknown>,
>(_page: FoldkitPage<Props, Flags>, _context: PageContext<Props>): Promise<ResolvedPageDocument> {
  throw new Error(
    '@opsydyn/astro-foldkit/server is not implemented yet. This task only establishes the public entry point.',
  );
}
