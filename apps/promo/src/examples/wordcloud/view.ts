import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { dataTable } from '@opsydyn/foldkit-viz/effect-ui/cartesian';
import { wordCloud } from '@opsydyn/foldkit-viz/layout/wordcloud';
import { Stream } from 'effect';

import { widthChanges } from '../shared/measurement';
import { fontFamily, Font, Spiral, type Metric } from './domain';
import { Message } from './message';
import { Measurement, type Model } from './model';

const ObserveCloud = Mount.makeStream('ObserveCloud', { args: {} }, (element: HTMLElement) =>
  Stream.concat(
    Stream.make(Message.MountedCloud()),
    Stream.map(widthChanges(element), (width) => Message.RecordedWidth({ width })),
  ),
);

const palette = [
  'var(--word-blue)',
  'var(--word-coral)',
  'var(--word-mint)',
  'var(--word-gold)',
  'var(--word-lavender)',
];

function measuredCloud(h: Html.H<Message>, model: Model, words: ReadonlyArray<Metric>) {
  const cloud = wordCloud(
    words,
    {
      key: (word) => word.id,
      text: (word) => word.text,
      width: (word) => word.width,
      height: (word) => word.height,
      rotation: (_word, index) => (model.settings.rotate && index % 3 === 1 ? 90 : 0),
    },
    {
      width: model.width,
      height: 350,
      padding: model.settings.padding,
      spiral: model.settings.spiral,
    },
  );
  return h.div(
    h
      .el('svg')
      .attrs({
        viewBox: `0 0 ${model.width} 350`,
        role: 'img',
        'aria-label': 'Illustrative visualisation vocabulary, sized by weight',
      })
      .children(
        h
          .el('desc')
          .children(
            'Words are placed using measured font bounds. Focus a word to read its weight.',
          ),
        ...cloud.words.map(({ key, text, x, y, rotation, datum }) =>
          h
            .el('g')
            .key(key)
            .attr('transform', `translate(${x},${y}) rotate(${rotation})`)
            .children(
              h
                .el('text')
                .attrs({
                  x: String(datum.xOffset),
                  y: String(datum.yOffset),
                  'font-family': fontFamily(model.settings.font),
                  'font-size': String(datum.size),
                  'font-weight': '600',
                  'text-anchor': 'middle',
                  fill:
                    palette[model.words.findIndex((word) => word.id === key) % palette.length] ??
                    'currentColor',
                  tabindex: '0',
                  'aria-label': `${text}: weight ${datum.value}`,
                  class: key === model.activeKey ? 'cloud-word active' : 'cloud-word',
                })
                .on('focus', Message.InspectedWord({ key }))
                .on('mouseenter', Message.InspectedWord({ key }))
                .children(text),
            ),
        ),
      ),
    h.p
      .class('primitive-status')
      .attr('aria-live', 'polite')
      .children(
        `${cloud.words.length} of ${words.length} words placed.`,
        cloud.omitted.length > 0 &&
          ` ${cloud.omitted.length} could not fit. Reduce size or padding to make room.`,
      ),
  );
}

const layoutSource = ({
  settings,
  width,
}: Model) => `import { wordCloud } from '@opsydyn/foldkit-viz/layout/wordcloud';

// A Command measures each word after the font loads.
const cloud = wordCloud(measuredWords, {
  key: d => d.id, text: d => d.text,
  width: d => d.width, height: d => d.height,
  rotation: (d, i) => ${settings.rotate ? '(i % 3 === 1 ? 90 : 0)' : '0'},
}, { width: ${Math.round(width)}, height: 350,
  padding: ${settings.padding}, spiral: '${settings.spiral}',
});
// Font: ${fontFamily(settings.font)}
// Largest word: ${settings.size}px
// Render cloud.words as SVG text; report cloud.omitted.
`;

export const view = (h: Html.H<Message>, model: Model) => {
  const action = (label: string, message: Message) =>
    h.button.attr('type', 'button').on('click', message).children(label);
  const toggle = (label: string, selected: boolean, message: Message) =>
    h.button
      .attrs({ type: 'button', 'aria-pressed': String(selected) })
      .on('click', message)
      .children(label);
  const range = (
    label: string,
    value: number,
    min: string,
    max: string,
    toMessage: (value: string) => Message,
  ) =>
    h.label(
      label + ' ',
      h.input
        .attrs({ type: 'range', min, max, step: '1' })
        .value(String(value))
        .on('input', ({ value }) => toMessage(value)),
      ` ${value}px`,
    );
  const chart = Measurement.match(model.measurement, {
    Loading: () =>
      h.p.class('primitive-placeholder').attr('role', 'status').children('Measuring text…'),
    Failed: ({ error }) =>
      h.div
        .class('primitive-placeholder')
        .children(
          h.p.attr('role', 'alert').children(error),
          action('Retry measurement', Message.ClickedRetry()),
        ),
    Ready: ({ words }) => measuredCloud(h, model, words),
  });
  const active = model.words.find(({ id }) => id === model.activeKey);

  return h.div.class('primitive-demo').children(
    h.div.class('primitive-controls').children(
      h.fieldset(
        h.legend('Spiral'),
        ...Spiral.literals.map((spiral) =>
          toggle(spiral, model.settings.spiral === spiral, Message.SelectedSpiral({ spiral })),
        ),
      ),
      h.fieldset(
        h.legend('Font'),
        ...Font.literals.map((font) =>
          toggle(font, model.settings.font === font, Message.SelectedFont({ font })),
        ),
      ),
      h.label.class('primitive-checkbox').children(
        h.input
          .attr('type', 'checkbox')
          .checked(model.settings.rotate)
          .on('change', ({ checked }) => Message.SelectedRotation({ rotate: checked })),
        'Rotate words',
      ),
      range('Padding', model.settings.padding, '0', '12', (value) =>
        Message.ChangedPadding({ value }),
      ),
      range('Largest word', model.settings.size, '24', '80', (value) =>
        Message.ChangedSize({ value }),
      ),
      action('Reset', Message.ClickedReset()),
    ),
    h.div
      .class('primitive-plot')
      .onMount(Mount.map(ObserveCloud(), (message) => message))
      .children(chart),
    h.p
      .class('primitive-status')
      .attr('aria-live', 'polite')
      .children(
        active
          ? `${active.text} · weight ${active.value}`
          : 'Hover or focus a word to inspect its weight.',
      ),
    h.details(h.summary('Read the layout code'), h.pre(h.code(layoutSource(model)))),
    h.details(
      h.summary('View all data'),
      dataTable(h, {
        caption: 'Illustrative vocabulary weights',
        headers: ['Word', 'Weight'],
        rows: model.words.map(({ text, value }) => [text, String(value)]),
      }),
    ),
  );
};
