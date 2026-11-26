import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Option } from 'effect';

import { EffectThreeStage, unlabelledSceneMount } from '../effect-ui-scene';
import { seriesCss } from './colours';
import { type Values, valuesFor } from './data';
import { layoutFor, orderedMonths } from './layout';
import { Message } from './message';
import {
  type Bar,
  isShown,
  type Model,
  type Order,
  type Series,
  seriesLabel,
  seriesList,
} from './model';
import { sceneFor } from './scene';

const orderLabel = { calendar: 'Sort by total', total: 'Calendar order' } satisfies Record<
  Order,
  string
>;

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class('e3-button').attr('type', 'button').on('click', message).children(label);

const legendEntry = (model: Model, h: Html.H<Message>, series: Series) =>
  h.button
    .class('e3-button')
    .attr('type', 'button')
    .attr('aria-pressed', String(isShown(model, series)))
    .on('click', Message.ClickedSeries({ series }))
    .children(
      h.span
        .class('e3-swatch')
        .style({ background: seriesCss(model.theme, series) })
        .children(),
      seriesLabel[series],
    );

const readout = (model: Model, values: Values): string =>
  Option.match(
    Option.orElse(model.hovered, () => model.selected),
    {
      onNone: () => 'Hover a bar to read it. Click to pin it. Click empty space to clear.',
      onSome: ({ month, series }: Bar) =>
        `${month} · ${seriesLabel[series]}: ${values[month][series]} visits`,
    },
  );

const dataTable = (model: Model, values: Values, h: Html.H<Message>) => {
  const shown = seriesList.filter((series) => isShown(model, series));
  return h.details
    .class('e3-table')
    .children(
      h.summary('Data table'),
      h.table(
        h.caption('Monthly visits by channel (sample data)'),
        h.thead(
          h.tr(
            h.th.attr('scope', 'col').children('Month'),
            ...shown.map((series) => h.th.attr('scope', 'col').children(seriesLabel[series])),
          ),
        ),
        h.tbody(
          ...orderedMonths(model, values).map((month) =>
            h.tr(
              h.th.attr('scope', 'row').children(month),
              ...shown.map((series) => h.td(String(values[month][series]))),
            ),
          ),
        ),
      ),
    );
};

export const view = (h: Html.H<Message>, model: Model) => {
  const values = valuesFor(model.seed);
  const { step } = layoutFor(model, values);
  return h.div.class('e3-sample').children(
    EffectThreeStage(h)
      .class('e3-stage')
      .on('scene-pointer-enter', ({ key }) => Message.HoveredBar({ key }))
      .on('scene-pointer-leave', ({ key }) => Message.LeftBar({ key }))
      .on('scene-click', ({ key }) => Message.ClickedBar({ key }))
      .on('scene-double-click', ({ key }) => Message.DoubleClickedBar({ key }))
      .on('scene-pointer-missed', Message.ClickedEmptySpace())
      .onMount(
        Mount.map(unlabelledSceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    h.p.class('e3-readout').attr('aria-live', 'polite').children(readout(model, values)),
    h.div
      .class('e3-controls')
      .children(
        button(h, 'New data', Message.ClickedNewData()),
        button(h, orderLabel[model.order], Message.ClickedOrder()),
      ),
    h.div
      .class('e3-controls')
      .attr('aria-label', 'Series')
      .children(...seriesList.map((series) => legendEntry(model, h, series))),
    h.p
      .class('e3-note')
      .children(
        `Gridlines every ${step} visits. Toggle a series in the legend, or double-click a bar to show only its series. `,
        'Every change eases. The Model holds the target and the scene shows the transition.',
      ),
    dataTable(model, values, h),
  );
};
