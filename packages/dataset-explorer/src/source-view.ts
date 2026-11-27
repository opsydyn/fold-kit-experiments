import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Option, Schema } from 'effect';

import { Message } from './message';
import type { Model } from './model';
import { sourceContent, SourceName } from './source';
import { highlightedCode } from './source-ui';

export const sourcePanel = (h: Html.H<Message>, model: Model): View.Input<Message> => {
  if (model.sources.length === 0) return undefined;
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
        .children(
          h.code(
            ...highlightedCode(
              h,
              sourceContent(model),
              model.activeFile,
              model.highlightedSource,
              model.activeFile,
            ),
          ),
        ),
    );
};
