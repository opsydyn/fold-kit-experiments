import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { view as plotPanel } from '../../ui/plot-panel/effect-ui';
import { Message } from './message';
import type { Model } from './model';
import { ObserveNavigation } from './subscription';

import * as styles from './request-diagnostics.css';

const routeLabel = (model: Model): string =>
  model.route._tag === 'Document'
    ? `${model.route.repository} / ${model.route.document}`
    : 'Diagnostics index';

export const view = (h: Html.H<Message>, model: Model) =>
  h.div
    .class(styles.root)
    .onMount(Mount.map(ObserveNavigation(), (message) => message))
    .children(
      h.div.class(styles.toolbar).children(
        h.button
          .class(styles.button)
          .attr('type', 'button')
          .on('click', Message.ClickedReload())
          .children('Reload metrics'),
        h.span
          .class(styles.status)
          .attr('role', 'status')
          .children(`${model.explorer._tag}: ${model.lastTransition}`),
        h.span
          .class(styles.status)
          .attr('data-diagnostics-route', '')
          .children(
            `${model.navigation.phase} ${model.navigation.path} from ${model.navigation.previousPath ?? 'none'} · ${routeLabel(model)}`,
          ),
        h.a
          .class(styles.status)
          .attr('href', '/request-diagnostics/acme/platform/docs/intro.md')
          .children('Open nested route'),
      ),
      h.div.class(styles.charts).children(
        h.div.class(styles.panel).children(
          h.span.class(styles.label).children('Latency distribution'),
          plotPanel(
            {
              model: model.histogram,
              toParentMessage: (message) => Message.ReceivedHistogramMessage({ message }),
              ariaLabel: 'Request latency distribution. Drag to filter the scatter plot.',
            },
            h,
          ),
        ),
        h.div.class(styles.panel).children(
          h.span.class(styles.label).children('Error rate'),
          plotPanel(
            {
              model: model.scatter,
              toParentMessage: (message) => Message.ReceivedScatterMessage({ message }),
              ariaLabel: 'Error rate by request latency.',
            },
            h,
          ),
        ),
      ),
    );
