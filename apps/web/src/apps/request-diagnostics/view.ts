import type { Document, Html } from 'foldkit/html';
import { html } from 'foldkit/html';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { ClickedReload, GotHistogramMessage, GotScatterMessage } from './message';
import type { Message } from './message';
import type { Model } from './model';

import * as styles from './request-diagnostics.css';

const stateLabel = (model: Model): string => `${model.explorer._tag}: ${model.lastTransition}`;
const routeLabel = (model: Model): string =>
  model.route._tag === 'Document'
    ? `${model.route.repository} / ${model.route.document}`
    : 'Diagnostics index';

export const view = (model: Model): Document => {
  const h = html<Message>();
  const histogram: Html = Histogram.view({
    model: model.histogram,
    toParentMessage: (message) => GotHistogramMessage({ message }),
    ariaLabel: 'Request latency distribution. Drag to filter the scatter plot.',
  });
  const scatter: Html = Scatter.view({
    model: model.scatter,
    toParentMessage: (message) => GotScatterMessage({ message }),
    ariaLabel: 'Error rate by request latency.',
  });

  return {
    title: 'Request Diagnostics — FoldKit Machine',
    body: h.div(
      [h.Class(styles.root)],
      [
        h.div(
          [h.Class(styles.toolbar)],
          [
            h.button([h.Class(styles.button), h.OnClick(ClickedReload())], ['Reload metrics']),
            h.span([h.Class(styles.status)], [stateLabel(model)]),
            h.span(
              [h.Class(styles.status)],
              [
                `${model.navigation.phase} ${model.navigation.path} from ${model.navigation.previousPath ?? 'none'} · ${routeLabel(model)}`,
              ],
            ),
            h.a(
              [h.Class(styles.status), h.Href('/request-diagnostics/acme/platform/docs/intro.md')],
              ['Open nested route'],
            ),
          ],
        ),
        h.div(
          [h.Class(styles.charts)],
          [
            h.div(
              [h.Class(styles.panel)],
              [h.span([h.Class(styles.label)], ['Latency distribution']), histogram],
            ),
            h.div(
              [h.Class(styles.panel)],
              [h.span([h.Class(styles.label)], ['Error rate']), scatter],
            ),
          ],
        ),
      ],
    ),
  };
};
