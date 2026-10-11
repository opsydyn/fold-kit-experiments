import { wordCloud } from '@opsydyn/foldkit-viz/layout/wordcloud';
import { Stream } from 'effect';
import { Mount } from 'foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { widthChanges } from '../shared/measurement';
import { fontFamily } from './domain';
import { Message } from './message';
import { Measurement } from './model';
import type { Model } from './model';
const MeasureCloudWidth = Mount.defineStream('MeasureCloudWidth', {
  messages: [Message.RecordedWidth],
  execute: ({ element }) =>
    widthChanges(element).pipe(Stream.map((width) => Message.RecordedWidth({ width }))),
});
const palette = [
  'var(--word-blue)',
  'var(--word-coral)',
  'var(--word-mint)',
  'var(--word-gold)',
  'var(--word-lavender)',
];
export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const chart = Measurement.match(model.measurement, {
    Loading: () => h.p([h.Class('primitive-placeholder'), h.Role('status')], ['Measuring text…']),
    Failed: ({ error }) =>
      h.div(
        [h.Class('primitive-placeholder')],
        [
          h.p([h.Role('alert')], [error]),
          h.button([h.Type('button'), h.OnClick(Message.ClickedRetry())], ['Retry measurement']),
        ],
      ),
    Ready: ({ words }) => {
      const cloud = wordCloud(
        words,
        {
          key: (d) => d.id,
          text: (d) => d.text,
          width: (d) => d.width,
          height: (d) => d.height,
          rotation: (_d, i) => (model.settings.rotate && i % 3 === 1 ? 90 : 0),
        },
        {
          width: model.width,
          height: 350,
          padding: model.settings.padding,
          spiral: model.settings.spiral,
        },
      );
      return h.div(
        [],
        [
          h.svg(
            [
              h.ViewBox(`0 0 ${model.width} 350`),
              h.Role('img'),
              h.AriaLabel('Illustrative visualisation vocabulary, sized by weight'),
            ],
            [
              h.desc(
                [],
                ['Words are placed using measured font bounds. Focus a word to read its weight.'],
              ),
              ...cloud.words.map((word) =>
                h.g(
                  [
                    h.Key(word.key),
                    h.Transform(`translate(${word.x},${word.y}) rotate(${word.rotation})`),
                  ],
                  [
                    h.text(
                      [
                        h.X(String(word.datum.xOffset)),
                        h.Y(String(word.datum.yOffset)),
                        h.FontFamily(fontFamily(model.settings.font)),
                        h.FontSize(String(word.datum.size)),
                        h.FontWeight('600'),
                        h.TextAnchor('middle'),
                        h.Fill(
                          palette[
                            model.words.findIndex((d) => d.id === word.key) % palette.length
                          ] ?? 'currentColor',
                        ),
                        h.Tabindex(0),
                        h.AriaLabel(`${word.text}: weight ${word.datum.value}`),
                        h.OnFocus(Message.InspectedWord({ key: word.key })),
                        h.OnMouseEnter(Message.InspectedWord({ key: word.key })),
                        h.Class(word.key === model.activeKey ? 'cloud-word active' : 'cloud-word'),
                      ],
                      [word.text],
                    ),
                  ],
                ),
              ),
            ],
          ),
          h.p(
            [h.Class('primitive-status'), h.AriaLive('polite')],
            [
              `${cloud.words.length} of ${words.length} words placed.`,
              ...(cloud.omitted.length
                ? [` ${cloud.omitted.length} could not fit. Reduce size or padding to make room.`]
                : []),
            ],
          ),
        ],
      );
    },
  });
  const active = model.words.find((d) => d.id === model.activeKey);
  const source = `import { wordCloud } from '@opsydyn/foldkit-viz/layout/wordcloud';\n\n// A Command measures each word after the font loads.\nconst cloud = wordCloud(measuredWords, {\n  key: d => d.id, text: d => d.text,\n  width: d => d.width, height: d => d.height,\n  rotation: (d, i) => ${model.settings.rotate ? '(i % 3 === 1 ? 90 : 0)' : '0'},\n}, { width: ${Math.round(model.width)}, height: 350,\n  padding: ${model.settings.padding}, spiral: '${model.settings.spiral}',\n});\n// Font: ${fontFamily(model.settings.font)}\n// Largest word: ${model.settings.size}px\n// Render cloud.words as SVG text; report cloud.omitted.\n`;
  return {
    title: 'Word cloud — Foldkit Viz',
    body: h.div(
      [h.Class('primitive-demo')],
      [
        h.div(
          [h.Class('primitive-controls')],
          [
            h.fieldset(
              [],
              [
                h.legend([], ['Spiral']),
                ...(['archimedean', 'rectangular'] as const).map((spiral) =>
                  h.button(
                    [
                      h.Type('button'),
                      h.AriaPressed(String(model.settings.spiral === spiral)),
                      h.OnClick(Message.SelectedSpiral({ spiral })),
                    ],
                    [spiral],
                  ),
                ),
              ],
            ),
            h.fieldset(
              [],
              [
                h.legend([], ['Font']),
                ...(['inter', 'monospace'] as const).map((font) =>
                  h.button(
                    [
                      h.Type('button'),
                      h.AriaPressed(String(model.settings.font === font)),
                      h.OnClick(Message.SelectedFont({ font })),
                    ],
                    [font],
                  ),
                ),
              ],
            ),
            h.label(
              [h.Class('primitive-checkbox')],
              [
                h.input([
                  h.Type('checkbox'),
                  h.Checked(model.settings.rotate),
                  h.OnClick(Message.SelectedRotation({ rotate: !model.settings.rotate })),
                ]),
                'Rotate words',
              ],
            ),
            h.label(
              [],
              [
                'Padding ',
                h.input([
                  h.Type('range'),
                  h.Min('0'),
                  h.Max('12'),
                  h.Step('1'),
                  h.Value(String(model.settings.padding)),
                  h.OnInput((value) => Message.ChangedPadding({ value })),
                ]),
                ` ${model.settings.padding}px`,
              ],
            ),
            h.label(
              [],
              [
                'Largest word ',
                h.input([
                  h.Type('range'),
                  h.Min('24'),
                  h.Max('80'),
                  h.Step('1'),
                  h.Value(String(model.settings.size)),
                  h.OnInput((value) => Message.ChangedSize({ value })),
                ]),
                ` ${model.settings.size}px`,
              ],
            ),
            h.button([h.Type('button'), h.OnClick(Message.ClickedReset())], ['Reset']),
          ],
        ),
        h.div([h.Class('primitive-plot'), h.OnMount(MeasureCloudWidth())], [chart]),
        h.p(
          [h.Class('primitive-status'), h.AriaLive('polite')],
          [
            active
              ? `${active.text} · weight ${active.value}`
              : 'Hover or focus a word to inspect its weight.',
          ],
        ),
        h.details([], [h.summary([], ['Read the layout code']), h.pre([], [h.code([], [source])])]),
        h.details(
          [],
          [
            h.summary([], ['View all data']),
            h.table(
              [],
              [
                h.caption([], ['Illustrative vocabulary weights']),
                h.thead(
                  [],
                  [
                    h.tr(
                      [],
                      [h.th([h.Scope('col')], ['Word']), h.th([h.Scope('col')], ['Weight'])],
                    ),
                  ],
                ),
                h.tbody(
                  [],
                  model.words.map((word) =>
                    h.tr([], [h.td([], [word.text]), h.td([], [String(word.value)])]),
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    ),
  };
};
