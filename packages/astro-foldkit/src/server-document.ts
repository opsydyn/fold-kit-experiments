import type { RenderedApplication } from 'foldkit/experimental/server';

import { readFoldkitBuildId } from './build-id';
import { renderFoldkitServerApplication } from './server-render';
import type { FoldkitPage, PageContext } from './types';

export type ResolvedPageDocument = {
  readonly title: string;
  readonly lang?: string;
  readonly dir?: 'ltr' | 'rtl' | 'auto';
  readonly canonical?: string;
  readonly ogUrl?: string;
};

const setOptional = <Key extends keyof Omit<ResolvedPageDocument, 'title'>>(
  document: ResolvedPageDocument,
  key: Key,
  value: ResolvedPageDocument[Key] | undefined,
): ResolvedPageDocument => (value === undefined ? document : { ...document, [key]: value });

export const mapRenderedApplicationDocument = (
  rendered: Pick<RenderedApplication, 'title' | 'lang' | 'dir' | 'canonical' | 'ogUrl'>,
): ResolvedPageDocument => {
  const withTitle = { title: rendered.title } as ResolvedPageDocument;
  const withLang = setOptional(withTitle, 'lang', rendered.lang);
  const withDir = setOptional(withLang, 'dir', rendered.dir);
  const withCanonical = setOptional(withDir, 'canonical', rendered.canonical);
  return setOptional(withCanonical, 'ogUrl', rendered.ogUrl);
};

export async function resolvePageDocument<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Flags extends Record<string, unknown> = Record<string, unknown>,
>(page: FoldkitPage<Props, Flags>, context: PageContext<Props>): Promise<ResolvedPageDocument> {
  const flags = page.flags(context);
  const config = await page.load();
  const rendered = await renderFoldkitServerApplication(config, flags, readFoldkitBuildId());
  return mapRenderedApplicationDocument(rendered);
}
