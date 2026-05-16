import type { Document } from 'foldkit/html';
import { html } from 'foldkit/html';

import * as BarChart from '../../ui/bar-chart';
import * as styles from './bar.css';
import type { Message } from './message';
import { GotBarMessage } from './message';
import type { Model } from './model';

type BarMessage = BarChart.Message;

const toParentMessage = (msg: BarMessage): Message => GotBarMessage({ inner: msg });

const { div, Class } = html<Message>();

export const view = (model: Model): Document => ({
  title: 'Bar Chart — foldkit-viz',
  body: div(
    [Class(styles.card)],
    [
      BarChart.view({
        model: model.bar,
        toParentMessage,
        ariaLabel: 'Monthly figures',
      }),
    ],
  ),
});
