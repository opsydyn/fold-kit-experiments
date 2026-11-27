import type { Html } from '@effect/ui/html';

import type { Message } from './message';
import { Model, type Model as ModelType } from './model';

import * as styles from './health.css';

const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short' });

const formatUptime = (uptimeSeconds: number): string => {
  const h = Math.floor(uptimeSeconds / 3600);
  const m = Math.floor((uptimeSeconds % 3600) / 60);
  const s = (uptimeSeconds % 60).toFixed(1);
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const skeleton = (h: Html.H<Message>) =>
  h.div
    .class(styles.grid)
    .attr('aria-busy', 'true')
    .children(
      h.div
        .class(styles.card)
        .children(h.div.class(styles.skeletonLabel), h.div.class(styles.skeletonValueLg)),
      h.div
        .class(styles.card)
        .children(
          h.div.class(styles.skeletonLabel),
          h.div.class(styles.skeletonValueLg),
          h.div.class(styles.skeletonSub),
        ),
      h.div
        .class(styles.card)
        .children(
          h.div.class(styles.skeletonLabel),
          h.div.class(styles.skeletonValueMd),
          h.div.class(styles.skeletonSub),
        ),
    );

export const view = (h: Html.H<Message>, model: ModelType) =>
  Model.match(model, {
    Loading: () => skeleton(h),
    Failed: ({ error }) =>
      h.div
        .class(styles.grid)
        .attr('role', 'alert')
        .children(
          h.div
            .class(styles.card)
            .children(
              h.div.class(styles.cardLabel).children('Status'),
              h.div.class(styles.cardValue, styles.cardValueError).children('error'),
              h.div.class(styles.cardSub).children(error),
            ),
        ),
    Loaded: ({ data, elapsedMs, sinceLabel }) => {
      const { status, uptimeSeconds, timestamp } = data;
      const liveUptimeSeconds = uptimeSeconds + elapsedMs / 1000;
      const liveServerTime = new Date(new Date(timestamp).getTime() + elapsedMs);

      return h.div
        .class(styles.grid)
        .children(
          h.div
            .class(styles.card)
            .children(
              h.div.class(styles.cardLabel).children('Status'),
              h.div
                .class(styles.cardValue, status === 'ok' ? styles.cardValueOk : '')
                .children(status),
            ),
          h.div
            .class(styles.card)
            .children(
              h.div.class(styles.cardLabel).children('Uptime'),
              h.div.class(styles.cardValue).children(formatUptime(liveUptimeSeconds)),
              h.div.class(styles.cardSub).children(`since ${sinceLabel}`),
            ),
          h.div
            .class(styles.card)
            .children(
              h.div.class(styles.cardLabel).children('Server time'),
              h.div
                .class(styles.cardValue, styles.cardValueSmall)
                .children(timeFormat.format(liveServerTime)),
              h.div.class(styles.cardSub).children(dateFormat.format(liveServerTime)),
            ),
        );
    },
  });
