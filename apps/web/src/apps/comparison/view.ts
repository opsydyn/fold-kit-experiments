import { Match, Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import * as PlotPanel from '../../ui/plot-panel';
import { matchingBinIndices, matchingKeys } from '../../ui/shared/inspection';
import { points } from './data';
import { Message } from './message';
import { Linking } from './model';
import type { Model, Panel } from './model';

import './comparison.css';

function panelView(
  panel: Panel,
  index: number,
  count: number,
  linked: Option.Option<ReadonlyArray<string>>,
  h: HtmlBuilder<Message>,
): Html {
  const keys = Option.getOrElse(linked, () => []);
  const name = `${panel._tag} ${panel.id}`;
  const headingId = `comparison-panel-${panel.id}`;
  const iconButton = (label: string, symbol: string, message: Message, disabled = false) =>
    h.button(
      [
        h.Type('button'),
        h.Class('comparison-icon'),
        h.AriaLabel(label),
        h.Title(label),
        // Keep the moved control focusable when it reaches an endpoint.
        h.AriaDisabled(disabled),
        h.OnClick(message),
      ],
      [h.span([h.Attribute('aria-hidden', 'true')], [symbol])],
    );
  const chart = Match.value(panel).pipe(
    Match.when({ _tag: 'Scatter' }, ({ id, chart }) => {
      const config = {
        model: chart,
        ariaLabel: `${name}: experience and salary`,
        toParentMessage: (message: PlotPanel.Message) => Message.GotScatterMessage({ id, message }),
      };
      // A linked inspection keeps its matching points bright and dims the rest.
      return PlotPanel.view(
        Option.isSome(linked) ? { ...config, highlight: { field: 'id', values: keys } } : config,
        h,
      );
    }),
    Match.when({ _tag: 'Histogram' }, ({ id, chart }) =>
      PlotPanel.view(
        {
          model: chart,
          ariaLabel: `${name}: salary distribution`,
          emphasis: matchingBinIndices(
            points,
            keys,
            PlotPanel.targetsOf(chart).map(({ domain: [x0, x1] }) => ({ x0, x1 })),
          ),
          toParentMessage: (message) => Message.GotHistogramMessage({ id, message }),
        },
        h,
      ),
    ),
    Match.exhaustive,
  );
  return h.section(
    [
      h.Key(String(panel.id)),
      h.Class('comparison-panel'),
      h.Attribute('aria-labelledby', headingId),
    ],
    [
      h.div(
        [h.Class('comparison-panel-header')],
        [
          h.h2([h.Id(headingId), h.Tabindex(-1)], [name]),
          h.div(
            [h.Class('comparison-actions')],
            [
              iconButton(
                `Move ${name} earlier`,
                '\u2191',
                Message.ClickedMovePanel({ id: panel.id, direction: 'earlier' }),
                index === 0,
              ),
              iconButton(
                `Move ${name} later`,
                '\u2193',
                Message.ClickedMovePanel({ id: panel.id, direction: 'later' }),
                index === count - 1,
              ),
              iconButton(`Remove ${name}`, '\u00d7', Message.ClickedRemovePanel({ id: panel.id })),
            ],
          ),
        ],
      ),
      h.div([h.Class('comparison-chart')], [chart]),
    ],
  );
}

export function body(model: Model, h: HtmlBuilder<Message>): Html {
  const linked = Linking.match(model.linking, { Independent: () => false, Linked: () => true });
  const inspection = Linking.match(model.linking, {
    Independent: () => Option.none(),
    Linked: ({ inspection }) => inspection,
  });
  const linkedKeys = Option.map(inspection, ({ value }) => matchingKeys(points, value));
  const keys = Option.getOrElse(linkedKeys, () => []);
  const cannotAdd = model.panels.length >= 4 || !Number.isSafeInteger(model.nextPanelId + 1);
  return h.div(
    [h.Class('comparison')],
    [
      h.div(
        [h.Class('comparison-toolbar')],
        [
          h.button(
            [
              h.Id('comparison-add-scatter'),
              h.Type('button'),
              h.Disabled(cannotAdd),
              h.OnClick(Message.ClickedAddPanel({ kind: 'scatter' })),
            ],
            ['Add scatter'],
          ),
          h.button(
            [
              h.Id('comparison-add-histogram'),
              h.Type('button'),
              h.Disabled(cannotAdd),
              h.OnClick(Message.ClickedAddPanel({ kind: 'histogram' })),
            ],
            ['Add histogram'],
          ),
          h.label(
            [],
            [
              h.input([
                h.Type('checkbox'),
                h.Checked(linked),
                h.OnClick(Message.ChangedLinkInspections({ enabled: !linked })),
              ]),
              'Link inspections',
            ],
          ),
          h.span(
            [h.Attribute('aria-live', 'polite'), h.Attribute('aria-atomic', 'true')],
            [`${keys.length} matching points`],
          ),
        ],
      ),
      h.p(
        [h.Class('comparison-caption')],
        ['Illustrative salary data ($), not a salary benchmark.'],
      ),
      h.div(
        [h.Class('comparison-panels')],
        model.panels.map((panel, index) =>
          panelView(panel, index, model.panels.length, linkedKeys, h),
        ),
      ),
      ...(model.panels.length === 0 ? [h.p([], ['No panels'])] : []),
    ],
  );
}

export function view(model: Model, h: HtmlBuilder<Message>): Document {
  return { title: 'Chart comparison', body: body(model, h) };
}
