import type { Document, Html } from 'foldkit/html';
import { html } from 'foldkit/html';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import type { Message } from './message';
import { GotHistogramMessage, GotScatterMessage } from './message';
import type { Model } from './model';

export const view = (model: Model): Document => {
  const h = html<Message>();

  const scatter: Html = Scatter.view({
    model: model.scatter,
    toParentMessage: (msg) => GotScatterMessage({ message: msg }),
    ariaLabel: 'Scatter chart — experience vs salary',
  });

  const histogram: Html = Histogram.view({
    model: model.histogram,
    toParentMessage: (msg) => GotHistogramMessage({ message: msg }),
    ariaLabel: 'Histogram — salary distribution',
  });

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
