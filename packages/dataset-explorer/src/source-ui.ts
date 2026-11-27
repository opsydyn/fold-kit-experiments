import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Effect, Match, Option, Queue, Result, Stream } from 'effect';
import type { RootContent } from 'hast';

import {
  codeTree,
  highlightedTree,
  loadHighlighter,
  type HighlightedSource,
} from './highlighting-core';
import { parseSourceLine, sourceLineId, type SourceLine } from './source-line-core';

const load = Effect.tryPromise({ try: loadHighlighter, catch: () => 'Highlighting unavailable' });
const cached = Effect.cached(load);
// Initialise the cache cell. I/O only starts when a browser command reads it.
// oxlint-disable-next-line linteffect/no-run-effect-outside-boundary
const highlighter = Effect.runSync(cached);

export const highlightSource = (source: string, language: string) =>
  highlighter.pipe(
    Effect.result,
    Effect.map((loaded) => ({
      source,
      language,
      tree: highlightedTree(source, language, Option.getOrUndefined(Result.getSuccess(loaded))),
    })),
    Effect.withSpan('highlightSource'),
  );

export const focusSourceLine = ({ name, line }: SourceLine) => {
  const focus = Effect.callback<void>((resume) => {
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(sourceLineId(name, line));
      element?.scrollIntoView({ block: 'start' });
      element?.focus({ preventScroll: true });
      resume(Effect.void);
    });
    return Effect.sync(() => cancelAnimationFrame(frame));
  });
  return focus.pipe(Effect.withSpan('focusSourceLine'));
};

export const sourceLineChanges = (element: HTMLElement): Stream.Stream<SourceLine> =>
  Stream.callback((queue) => {
    const subscribe = Effect.sync(() => {
      const window = element.ownerDocument.defaultView;
      const navigate = () =>
        Option.map(parseSourceLine(window?.location.hash ?? ''), (line) =>
          Queue.offerUnsafe(queue, line),
        );
      window?.addEventListener('hashchange', navigate);
      navigate();
      return () => window?.removeEventListener('hashchange', navigate);
    });
    return Effect.acquireRelease(subscribe, (close) => Effect.sync(close)).pipe(
      // The listener is released when the mount's stream scope closes.
      // oxlint-disable-next-line linteffect/no-effect-never
      Effect.andThen(Effect.never),
    );
  });

export function highlightedCode<M>(
  h: Html.H<M>,
  source: string,
  language: string,
  cached?: HighlightedSource,
  sourceId?: string,
): ReadonlyArray<View.Input<M>> {
  const render = (node: RootContent): View.Input<M> =>
    Match.value(node).pipe(
      Match.when({ type: 'text' }, ({ value }) => value),
      Match.when({ type: 'element' }, (node) => {
        const { className, id, href, ariaLabel, dataLine } = node.properties;
        const attributes = {
          class: Array.isArray(className) ? className.join(' ') : undefined,
          id: id === undefined ? undefined : String(id),
          tabindex: id === undefined ? undefined : '-1',
        };
        const children = node.children.flatMap((child) =>
          child.type === 'element' || child.type === 'text' ? [render(child)] : [],
        );
        return node.tagName === 'a'
          ? h.a
              .attrs({
                ...attributes,
                href: String(href),
                'aria-label': String(ariaLabel),
                'data-line': String(dataLine),
              })
              .children(...children)
          : h.span.attrs(attributes).children(...children);
      }),
      Match.orElse(() => undefined),
    );
  return codeTree(source, language, cached, sourceId).children.map(render);
}
