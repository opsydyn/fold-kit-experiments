import type { Document, HtmlBuilder } from 'foldkit/html';

import type { Message } from './message';
import { Reset } from './message';
import type { Model } from './model';

import * as styles from './greeting.css';

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const { div, p, button, Class, OnClick } = h;
  return {
    title: `Hello, ${model}!`,
    body: div(
      [Class(styles.card)],
      [
        p([Class(styles.greeting)], [`Hello, ${model}!`]),
        button([Class(styles.button), OnClick(Reset())], ['Reset']),
      ],
    ),
  };
};
