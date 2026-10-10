import { Option, Schema } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';

import { highlightedCode } from './highlighting';
import { Message } from './message';
import type { Model } from './model';
import { sourceContent, SourceName } from './source';

export const sourcePanel = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> =>
  model.sources.length === 0
    ? []
    : [
        h.section(
          [h.Class('query-panel query-source'), h.AriaLabel('Running source')],
          [
            h.div(
              [h.Class('query-readout')],
              [
                h.div(
                  [],
                  [
                    h.h2([h.Class('query-section-title')], ['Running source']),
                    h.p(
                      [h.Class('query-hint')],
                      [
                        'These files power this example. Select snapshot.json to follow the chart’s current data.',
                      ],
                    ),
                  ],
                ),
                h.label(
                  [h.Class('query-source-label')],
                  [
                    'Source file',
                    h.select(
                      [
                        h.AriaLabel('Source file'),
                        h.Value(model.activeFile),
                        h.OnChange((value) =>
                          Option.match(Schema.decodeUnknownOption(SourceName)(value), {
                            onNone: () => Message.SelectedSource({ name: model.activeFile }),
                            onSome: (name) => Message.SelectedSource({ name }),
                          }),
                        ),
                      ],
                      [...model.sources.map((source) => source.name), 'snapshot.json'].map((name) =>
                        h.option([h.Value(name), h.Selected(name === model.activeFile)], [name]),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            h.pre(
              [
                h.Class('query-source-code syntax-highlight'),
                h.Tabindex(0),
                h.AriaLabel(model.activeFile),
              ],
              [
                h.code(
                  [],
                  highlightedCode(
                    h,
                    sourceContent(model),
                    model.activeFile,
                    model.highlightedSource,
                  ),
                ),
              ],
            ),
          ],
        ),
      ];
