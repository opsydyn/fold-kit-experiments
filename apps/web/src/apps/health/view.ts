import type { Document, HtmlBuilder } from 'foldkit/html';

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

const skeleton = (h: HtmlBuilder<Message>): Document => {
  const { div, Class } = h;
  return {
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
};

export const view = (model: ModelType, h: HtmlBuilder<Message>): Document => {
  const { div, Class } = h;
  return Model.match(model, {
    Loading: () => skeleton(h),
    Failed: ({ error }) => ({
      title: 'Health — Astro + FoldKit',
      body: div(
        [Class(styles.grid)],
        [
          div(
            [Class(styles.card)],
            [
              div([Class(styles.cardLabel)], ['Status']),
              div([Class(`${styles.cardValue} ${styles.cardValueError}`)], ['error']),
              div([Class(styles.cardSub)], [error]),
            ],
          ),
        ],
      ),
    }),
    Loaded: ({ data, elapsedMs, sinceLabel }) => {
      const { status, uptimeSeconds, timestamp } = data;
      const liveUptimeSeconds = uptimeSeconds + elapsedMs / 1000;
      const liveServerTime = new Date(new Date(timestamp).getTime() + elapsedMs);

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
                div([Class(styles.cardSub)], [`since ${sinceLabel}`]),
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
    },
  });
};
