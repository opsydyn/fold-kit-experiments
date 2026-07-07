import type { Document } from 'foldkit/html';
import { html } from 'foldkit/html';

import type { Message } from './message';
import { Reset } from './message';
import type { Model } from './model';

import * as styles from './greeting.css';

const { div, p, button, Class, OnClick } = html<Message>();

export const view = (model: Model): Document => ({
  title: `Hello, ${model}!`,
  body: div(
    [Class(styles.card)],
    [
      p([Class(styles.greeting)], [`Hello, ${model}!`]),
      button([Class(styles.button), OnClick(Reset())], ['Reset']),
    ],
  ),
});
