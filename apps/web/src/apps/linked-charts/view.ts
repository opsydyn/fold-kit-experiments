import { Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import * as PlotPanel from '../../ui/plot-panel';
import { matchingBinIndices, matchingKeys } from '../../ui/shared/inspection';
import { Message } from './message';
import { POINTS } from './model';
import type { Model } from './model';

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const keys = Option.match(model.inspection, {
    onNone: () => [],
    onSome: (inspection) => matchingKeys(POINTS, inspection),
  });
  const bins = PlotPanel.targetsOf(model.histogram).map((bin) => ({
    x0: bin.domain[0],
    x1: bin.domain[1],
  }));
  const scatter: Html = PlotPanel.view(
    Option.isSome(model.inspection)
      ? {
          model: model.scatter,
          highlight: { field: 'id', values: keys },
          toParentMessage: (msg) => Message.ReceivedScatterMessage({ message: msg }),
          ariaLabel: 'Scatter chart — experience vs salary',
        }
      : {
          model: model.scatter,
          toParentMessage: (msg) => Message.ReceivedScatterMessage({ message: msg }),
          ariaLabel: 'Scatter chart — experience vs salary',
        },
    h,
  );
  const histogram: Html = PlotPanel.view(
    {
      model: model.histogram,
      emphasis: matchingBinIndices(POINTS, keys, bins),
      toParentMessage: (msg) => Message.ReceivedHistogramMessage({ message: msg }),
      ariaLabel: 'Histogram — salary distribution',
    },
    h,
  );
  return {
    title: 'Linked views — foldkit-viz',
    body: h.div(
      [h.Style({ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' })],
      [
        h.div(
          [h.Style({ flex: '1 1 360px' })],
          [
            h.p(
              [
                h.Style({
                  fontSize: '0.75rem',
                  color: '#888',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                }),
              ],
              ['Experience vs Salary — hover to highlight bin'],
            ),
            scatter,
            ...(Option.isSome(model.inspection)
              ? [h.p([h.Attribute('aria-live', 'polite')], [`${keys.length} matching points`])]
              : []),
          ],
        ),
        h.div(
          [h.Style({ flex: '1 1 340px' })],
          [
            h.p(
              [
                h.Style({
                  fontSize: '0.75rem',
                  color: '#888',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                }),
              ],
              ['Salary distribution — hover bin to highlight points'],
            ),
            histogram,
          ],
        ),
      ],
    ),
  };
};
