import type { Document } from 'foldkit/html';
import { html } from 'foldkit/html';

import type { Message } from './message';
import type { Model } from './model';
import * as styles from './timestamp.css';

const { div, Class } = html<Message>();

const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });

const formatUptime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
    : `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
};

export const view = (model: Model): Document => {
  const uptimeSeconds = model.elapsedMs / 1000;
  const startedAtLabel = timeFormat.format(new Date(model.startedAt));

  return {
    title: `Uptime: ${formatUptime(uptimeSeconds)}`,
    body: div(
      [Class(styles.card)],
      [
        div([Class(styles.label)], ['Server uptime']),
        div([Class(styles.value)], [formatUptime(uptimeSeconds)]),
        div([Class(styles.sub)], [`started ${startedAtLabel}`]),
      ],
    ),
  };
};
