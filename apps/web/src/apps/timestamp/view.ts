import type { Html } from '@effect/ui/html';

import type { Message } from './message';
import type { Model } from './model';

import * as styles from './timestamp.css';

const timeFormat = new Intl.DateTimeFormat('en', { timeStyle: 'medium', timeZone: 'UTC' });

const formatUptime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
    : `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
};

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class(styles.card).children(
    h.div.class(styles.label).children('Server uptime'),
    h.div
      .class(styles.value)
      .attr('data-uptime', '')
      .children(formatUptime(model.elapsedMs / 1000)),
    h.div
      .class(styles.sub)
      .children(
        'started ',
        h.time
          .attr('datetime', model.startedAt)
          .children(model.localStart ?? timeFormat.format(new Date(model.startedAt))),
      ),
  );
