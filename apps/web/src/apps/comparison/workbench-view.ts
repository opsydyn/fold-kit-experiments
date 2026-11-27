import type { Html } from '@effect/ui/html';
import { Option } from 'effect';

import { targetsOf, type Message as PanelMessage } from '../../ui/plot-panel/core';
import { view as plotPanel } from '../../ui/plot-panel/effect-ui';
import { matchingBinIndices, matchingKeys } from '../../ui/shared/inspection';
import { points } from './data';
import { addScatterRef, headingId, headingRef } from './workbench-focus';
import { Message, canAdd, type Model, type Panel } from './workbench-state';

import './comparison.css';

function panelView<M>(
  h: Html.H<M>,
  panel: Panel,
  index: number,
  count: number,
  linked: Option.Option<ReadonlyArray<string>>,
  send: (message: Message) => M,
) {
  const keys = Option.getOrElse(linked, () => []);
  const { id, chart, _tag: kind } = panel;
  const name = `${kind} ${id}`;
  const iconButton = (label: string, symbol: string, message: Message, disabled = false) =>
    h.button
      .class('comparison-icon')
      .attrs({
        type: 'button',
        'aria-label': label,
        title: label,
        'aria-disabled': String(disabled),
      })
      .on('click', send(message))
      .children(h.span.attr('aria-hidden', 'true').children(symbol));
  const config = {
    model: chart,
    toParentMessage: (message: PanelMessage) =>
      send(Message.ReceivedPanelMessage({ id, kind, message })),
  };
  const scatter = { ...config, ariaLabel: `${name}: experience and salary` };
  const chartView =
    kind === 'Scatter'
      ? plotPanel(
          Option.isSome(linked)
            ? { ...scatter, highlight: { field: 'id', values: keys } }
            : scatter,
          h,
        )
      : plotPanel(
          {
            ...config,
            ariaLabel: `${name}: salary distribution`,
            emphasis: matchingBinIndices(
              points,
              keys,
              targetsOf(chart).map(({ domain: [x0, x1] }) => ({ x0, x1 })),
            ),
          },
          h,
        );
  return h.section
    .key(String(id))
    .class('comparison-panel')
    .attr('aria-labelledby', headingId(id))
    .children(
      h.div.class('comparison-panel-header').children(
        h.h2
          .ref(headingRef(id))
          .attrs({ id: headingId(id), tabindex: '-1' })
          .children(name),
        h.div
          .class('comparison-actions')
          .children(
            iconButton(
              `Move ${name} earlier`,
              '↑',
              Message.ClickedMovePanel({ id, direction: 'earlier' }),
              index === 0,
            ),
            iconButton(
              `Move ${name} later`,
              '↓',
              Message.ClickedMovePanel({ id, direction: 'later' }),
              index === count - 1,
            ),
            iconButton(`Remove ${name}`, '×', Message.ClickedRemovePanel({ id })),
          ),
      ),
      h.div.class('comparison-chart').children(chartView),
    );
}

export function workbenchView<M>(h: Html.H<M>, model: Model, send: (message: Message) => M) {
  const linked = model.linking._tag === 'Linked';
  const inspection = linked ? model.linking.inspection : Option.none();
  const linkedKeys = Option.map(inspection, ({ value }) => matchingKeys(points, value));
  const count = Option.getOrElse(
    Option.map(linkedKeys, (keys) => keys.length),
    () => 0,
  );
  const cannotAdd = !canAdd(model);
  return h.div.class('comparison').children(
    h.div.class('comparison-toolbar').children(
      h.button
        .ref(addScatterRef)
        .attrs({ id: 'comparison-add-scatter', type: 'button' })
        .disabled(cannotAdd)
        .on('click', send(Message.ClickedAddPanel({ kind: 'scatter' })))
        .children('Add scatter'),
      h.button
        .attrs({ id: 'comparison-add-histogram', type: 'button' })
        .disabled(cannotAdd)
        .on('click', send(Message.ClickedAddPanel({ kind: 'histogram' })))
        .children('Add histogram'),
      h.label.children(
        h.input
          .attr('type', 'checkbox')
          .checked(linked)
          .on('click', send(Message.ChangedLinkInspections({ enabled: !linked }))),
        'Link inspections',
      ),
      h.span
        .attrs({ 'aria-live': 'polite', 'aria-atomic': 'true' })
        .children(`${count} matching points`),
    ),
    h.p
      .class('comparison-caption')
      .children('Illustrative salary data ($), not a salary benchmark.'),
    h.div
      .class('comparison-panels')
      .children(
        ...model.panels.map((panel, index) =>
          panelView(h, panel, index, model.panels.length, linkedKeys, send),
        ),
      ),
    model.panels.length === 0 ? h.p.children('No panels') : undefined,
  );
}
