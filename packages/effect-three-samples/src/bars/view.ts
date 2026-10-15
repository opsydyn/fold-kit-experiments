import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
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

const orderLabel = {
  calendar: 'Sort by total',
  total: 'Calendar order',
} satisfies Record<Order, string>;

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

/** A legend entry that also toggles its series: identity never rests on colour alone. */
const legendEntry = (model: Model, h: HtmlBuilder<Message>, series: Series): Html =>
  h.button(
    [
      h.Class('e3-button'),
      h.Type('button'),
      h.AriaPressed(String(isShown(model, series))),
      h.OnClick(Message.ClickedSeries({ series })),
    ],
    [
      h.span([h.Class('e3-swatch'), h.Style({ background: seriesCss(model.theme, series) })], []),
      seriesLabel[series],
    ],
  );

const describe = (values: Values, bar: Bar): string =>
  `${bar.month} · ${seriesLabel[bar.series]}: ${values[bar.month][bar.series]} visits`;

/** The hovered bar, else the pinned one, else a hint. */
const readout = (model: Model, values: Values): string =>
  Option.match(
    Option.orElse(model.hovered, () => model.selected),
    {
      onNone: () => 'Hover a bar to read it. Click to pin it; click empty space to clear.',
      onSome: (bar) => describe(values, bar),
    },
  );

const dataTable = (model: Model, values: Values, h: HtmlBuilder<Message>): Html => {
  const shown = seriesList.filter((series) => isShown(model, series));
  return h.details(
    [h.Class('e3-table')],
    [
      h.summary([], ['Data table']),
      h.table(
        [],
        [
          h.caption([], ['Monthly visits by channel (sample data)']),
          h.thead(
            [],
            [
              h.tr(
                [],
                [
                  h.th([h.Scope('col')], ['Month']),
                  ...shown.map((series) => h.th([h.Scope('col')], [seriesLabel[series]])),
                ],
              ),
            ],
          ),
          h.tbody(
            [],
            orderedMonths(model, values).map((month) =>
              h.tr(
                [],
                [
                  h.th([h.Scope('row')], [month]),
                  ...shown.map((series) => h.td([], [String(values[month][series])])),
                ],
              ),
            ),
          ),
        ],
      ),
    ],
  );
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const values = valuesFor(model.seed);
  const { step } = layoutFor(model, values);
  return {
    title: '3D bar chart — effect-three',
    body: h.div(
      [h.Class('e3-sample')],
      [
        EffectThreeFoldkit.view(
          {
            scene: sceneFor(model),
            mount: sceneMount,
            className: 'e3-stage',
            onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
            onPointerEnter: ({ key }) => Message.HoveredBar({ key }),
            onPointerLeave: ({ key }) => Message.LeftBar({ key }),
            onClick: ({ key }) => Message.ClickedBar({ key }),
            onDoubleClick: ({ key }) => Message.DoubleClickedBar({ key }),
            onPointerMissed: () => Message.ClickedEmptySpace(),
          },
          h,
        ),
        h.p([h.Class('e3-readout'), h.AriaLive('polite')], [readout(model, values)]),
        h.div(
          [h.Class('e3-controls')],
          [
            button(h, 'New data', Message.ClickedNewData()),
            button(h, orderLabel[model.order], Message.ClickedOrder()),
          ],
        ),
        h.div(
          [h.Class('e3-controls'), h.AriaLabel('Series')],
          seriesList.map((series) => legendEntry(model, h, series)),
        ),
        h.p(
          [h.Class('e3-note')],
          [
            `Gridlines every ${step} visits. Toggle a series in the legend, or double-click a bar to show only its series. `,
            'Every change eases: the Model holds the target, the scene shows the journey.',
          ],
        ),
        dataTable(model, values, h),
      ],
    ),
  };
};
