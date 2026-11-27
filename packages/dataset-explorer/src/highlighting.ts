import { Effect, Match, Option, Schema } from 'effect';
import { ManagedResource } from 'foldkit';
import type { Command } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import type { Return } from 'foldkit/update';
import type { Root, Element, Text } from 'hast';

import { codeTree, loadHighlighter, sourceMatches } from './highlighting-core';
import type {
  Highlighter,
  HighlightedSource,
  HighlightingModel,
  SourceKey,
} from './highlighting-core';

export * from './highlighting-core';

export const SourceHighlighter = ManagedResource.tag<Highlighter>()('SourceHighlighter');
export type HighlightingService = ManagedResource.ServiceOf<typeof SourceHighlighter>;
export interface HighlightingLifecycle<Message> {
  readonly acquired: () => Message;
  readonly failed: () => Message;
  readonly released: () => Message;
}
export function highlightingResources<Model, Message>(messages: HighlightingLifecycle<Message>) {
  return ManagedResource.make<Model, Message>()((entry) => ({
    sourceHighlighter: entry(Schema.Option(Schema.Null), {
      resource: SourceHighlighter,
      modelToMaybeRequirements: () => Option.some(null),
      acquire: () =>
        Effect.tryPromise({ try: loadHighlighter, catch: () => 'Highlighting unavailable' }),
      release: () => Effect.void,
      onAcquired: () => messages.acquired(),
      onAcquireError: () => messages.failed(),
      onReleased: () => messages.released(),
    }),
  }));
}
export function requestHighlighting<Model extends HighlightingModel, Message>(
  result: Return<Model, Message, HighlightingService>,
  source: string,
  language: string,
  command: (key: SourceKey) => Command.Command<Message, never, HighlightingService>,
): Return<Model, Message, HighlightingService> {
  const unchanged =
    // The lifecycle schema limits this status to ready or failed.
    // oxlint-disable-next-line linteffect/no-magic-domain-string
    result.model.highlighting !== 'ready' ||
    sourceMatches(result.model.highlightedSource, source, language) ||
    sourceMatches(result.model.requestedSource, source, language);
  // Preserve model identity and commands on cache hits and while the resource is unavailable.
  // oxlint-disable-next-line linteffect/no-if-statement
  if (unchanged) return result;
  const requestedSource = { source, language };
  return {
    ...result,
    model: { ...result.model, requestedSource },
    commands: [...(result.commands ?? []), command(requestedSource)],
  };
}

export function highlightedCode<Message>(
  h: HtmlBuilder<Message>,
  source: string,
  language: string,
  cached?: HighlightedSource,
  sourceId?: string,
): ReadonlyArray<Html | string> {
  const render = (node: Root | Element | Text): ReadonlyArray<Html | string> =>
    Match.value(node).pipe(
      Match.when({ type: 'text' }, (text) => [text.value]),
      Match.orElse(renderParent),
    );
  const classNames = (value: Element['properties']['className']): string =>
    Match.value(value).pipe(
      Match.when(Array.isArray, (classes) => classes.join(' ')),
      Match.orElse(() => ''),
    );
  function renderParent(parent: Root | Element): ReadonlyArray<Html | string> {
    return Match.value(parent).pipe(
      Match.when({ type: 'root' }, (root) => root.children.flatMap(renderContent)),
      Match.orElse(renderElement),
    );
  }
  function renderElement(element: Element): ReadonlyArray<Html | string> {
    const children = element.children.flatMap(renderContent);
    const props = element.properties;
    const attributes = [
      h.Class(classNames(props.className)),
      ...Option.match(Option.fromNullishOr(props.id), {
        onNone: () => [],
        onSome: (id) => [h.Id(String(id)), h.Tabindex(-1)],
      }),
    ];
    return Match.value(element.tagName).pipe(
      Match.when('a', () => [
        h.a(
          [
            ...attributes,
            h.Href(String(props.href)),
            h.AriaLabel(String(props.ariaLabel)),
            h.DataAttribute('line', String(props.dataLine)),
          ],
          children,
        ),
      ]),
      Match.orElse(() => [h.span(attributes, children)]),
    );
  }
  const renderContent = (node: Root['children'][number]): ReadonlyArray<Html | string> =>
    Match.value(node).pipe(
      Match.when({ type: 'element' }, render),
      Match.when({ type: 'text' }, render),
      Match.orElse(() => []),
    );
  return codeTree(source, language, cached, sourceId).children.flatMap(renderContent);
}
