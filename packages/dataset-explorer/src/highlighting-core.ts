import type { createStarryNight } from '@wooorm/starry-night';
import { Option, Schema } from 'effect';
import type { Root } from 'hast';

import { linkedSourceTree } from './source-line-core';

// The runtime owns the opaque engine; application state contains only source keys and tokens.
export type Highlighter = Pick<
  Awaited<ReturnType<typeof createStarryNight>>,
  'flagToScope' | 'highlight' | 'missingScopes'
>;
export const Highlighting = Schema.optional(Schema.Literals(['ready', 'failed']));
// Resource acquisition loads the engine; views consume serialisable settled tokens.
export async function loadHighlighter() {
  // The WASM/grammar bundle is loaded only when a live app requests it.
  // oxlint-disable-next-line linteffect/prevent-dynamic-imports
  const browser = await import('./highlighting-browser');
  return browser.createBrowserHighlighter();
}

export type TokenTree = Root;
export const HighlightedSource = Schema.Struct({
  source: Schema.String,
  language: Schema.String,
  tree: Schema.declare(
    (value): value is Root =>
      // The engine produces HAST roots; the boundary checks the root discriminator.
      // oxlint-disable-next-line linteffect/no-magic-domain-string, linteffect/no-domain-logic-in-conditional
      typeof value === 'object' && value !== null && 'type' in value && value.type === 'root',
  ),
});
export type HighlightedSource = typeof HighlightedSource.Type;
export const SourceKey = Schema.Struct({ source: Schema.String, language: Schema.String });
export type SourceKey = typeof SourceKey.Type;
export interface HighlightingModel {
  readonly highlighting?: 'ready' | 'failed' | undefined;
  readonly highlightedSource?: HighlightedSource | undefined;
  readonly requestedSource?: SourceKey | undefined;
}
export function sourceMatches(
  key: SourceKey | undefined,
  source: string,
  language: string,
): boolean {
  return key?.source === source && key.language === language;
}
export function settleHighlighting<Model extends HighlightingModel>(
  model: Model,
  highlightedSource: HighlightedSource,
  source: string,
  language: string,
): Model {
  // Keep the generic model unchanged for stale results.
  // oxlint-disable-next-line linteffect/no-if-statement
  if (!sourceMatches(highlightedSource, source, language)) return model;
  return { ...model, highlightedSource, requestedSource: undefined };
}

export function highlightedTree(
  source: string,
  language: string,
  highlighter?: Highlighter | null,
): TokenTree {
  function tokens(engine: Highlighter): Option.Option<Root> {
    return Option.map(Option.fromNullishOr(engine.flagToScope(language)), (scope) =>
      engine.highlight(source, scope),
    );
  }
  return Option.fromNullishOr(highlighter).pipe(
    Option.flatMap(tokens),
    Option.getOrElse((): Root => ({ type: 'root', children: [{ type: 'text', value: source }] })),
  );
}

export function codeTree(
  source: string,
  language: string,
  cached?: HighlightedSource,
  sourceId?: string,
): Root {
  const tree = Option.fromNullishOr(cached).pipe(
    Option.filter((entry) => sourceMatches(entry, source, language)),
    Option.map((entry) => entry.tree),
    Option.getOrElse(() => highlightedTree(source, language)),
  );
  return Option.match(Option.fromNullishOr(sourceId), {
    onNone: () => tree,
    onSome: (name) => linkedSourceTree(tree, name),
  });
}
