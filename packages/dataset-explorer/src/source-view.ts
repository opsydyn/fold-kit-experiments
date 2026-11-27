import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Match, Option, Schema } from 'effect';
import type { RootContent } from 'hast';

import { codeTree } from './highlighting-core';
import { Message } from './message';
import type { Model } from './model';
import { sourceContent, SourceName } from './source';

export const sourcePanel = (h: Html.H<Message>, model: Model): View.Input<Message> => {
  if (model.sources.length === 0) return undefined;
  const render = (node: RootContent): View.Input<Message> =>
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
  const tree = codeTree(
    sourceContent(model),
    model.activeFile,
    model.highlightedSource,
    model.activeFile,
  );
  return h.section
    .class('query-panel query-source')
    .attr('aria-label', 'Running source')
    .children(
      h.div.class('query-readout').children(
        h.div(
          h.h2.class('query-section-title').children('Running source'),
          h.p
            .class('query-hint')
            .children(
              'These files power this example. Select snapshot.json to follow the chart’s current data.',
            ),
        ),
        h.label.class('query-source-label').children(
          'Source file',
          h.select
            .attr('aria-label', 'Source file')
            .value(model.activeFile)
            .on('change', ({ value }) =>
              Option.match(Schema.decodeUnknownOption(SourceName)(value), {
                onNone: () => Message.SelectedSource({ name: model.activeFile }),
                onSome: (name) => Message.SelectedSource({ name }),
              }),
            )
            .children(
              ...[...model.sources.map((source) => source.name), 'snapshot.json'].map((name) =>
                h.option.attr('value', name).children(name),
              ),
            ),
        ),
      ),
      h.pre
        .class('query-source-code syntax-highlight')
        .attrs({ tabindex: '0', 'aria-label': model.activeFile })
        .children(h.code(...tree.children.map(render))),
    );
};
