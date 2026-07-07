import type { Document } from 'foldkit/html';
import { html } from 'foldkit/html';

import type { Message } from './message';
import type { Model } from './model';

import * as styles from './health.css';

const { div, Class } = html<Message>();

const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short' });

const formatUptime = (uptimeSeconds: number): string => {
  const h = Math.floor(uptimeSeconds / 3600);
  const m = Math.floor((uptimeSeconds % 3600) / 60);
  const s = (uptimeSeconds % 60).toFixed(1);
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const skeleton: Document = {
  title: 'Health — Astro + FoldKit',
  body: div(
    [Class(styles.grid)],
    [
      div(
        [Class(styles.card)],
        [div([Class(styles.skeletonLabel)], []), div([Class(styles.skeletonValueLg)], [])],
      ),
      div(
        [Class(styles.card)],
        [
          div([Class(styles.skeletonLabel)], []),
          div([Class(styles.skeletonValueLg)], []),
          div([Class(styles.skeletonSub)], []),
        ],
      ),
      div(
        [Class(styles.card)],
        [
          div([Class(styles.skeletonLabel)], []),
          div([Class(styles.skeletonValueMd)], []),
          div([Class(styles.skeletonSub)], []),
        ],
      ),
    ],
  ),
};

export const view = (model: Model): Document => {
  switch (model._tag) {
    case 'Loading':
      return skeleton;

    case 'Failed':
      return {
        title: 'Health — Astro + FoldKit',
        body: div(
          [Class(styles.grid)],
          [
            div(
              [Class(styles.card)],
              [
                div([Class(styles.cardLabel)], ['Status']),
                div([Class(`${styles.cardValue} ${styles.cardValueError}`)], ['error']),
                div([Class(styles.cardSub)], [model.error]),
              ],
            ),
          ],
        ),
      };

    case 'Loaded': {
      const { status, uptimeSeconds, timestamp } = model.data;
      const liveUptimeSeconds = uptimeSeconds + model.elapsedMs / 1000;
      const liveServerTime = new Date(new Date(timestamp).getTime() + model.elapsedMs);

      return {
        title: 'Health — Astro + FoldKit',
        body: div(
          [Class(styles.grid)],
          [
            div(
              [Class(styles.card)],
              [
                div([Class(styles.cardLabel)], ['Status']),
                div(
                  [
                    Class(
                      status === 'ok'
                        ? `${styles.cardValue} ${styles.cardValueOk}`
                        : styles.cardValue,
                    ),
                  ],
                  [status],
                ),
              ],
            ),
            div(
              [Class(styles.card)],
              [
                div([Class(styles.cardLabel)], ['Uptime']),
                div([Class(styles.cardValue)], [formatUptime(liveUptimeSeconds)]),
                div([Class(styles.cardSub)], [`since ${model.sinceLabel}`]),
              ],
            ),
            div(
              [Class(styles.card)],
              [
                div([Class(styles.cardLabel)], ['Server time']),
                div(
                  [Class(`${styles.cardValue} ${styles.cardValueSmall}`)],
                  [timeFormat.format(liveServerTime)],
                ),
                div([Class(styles.cardSub)], [dateFormat.format(liveServerTime)]),
              ],
            ),
          ],
        ),
      };
    }
  }
};
