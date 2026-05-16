import type { Document } from 'foldkit/html';
import { html } from 'foldkit/html';

import type { Message } from './message';
import type { Model } from './model';
import * as styles from './welcome.css';

const { div, p, a, Class, Href } = html<Message>();

export const view = (model: Model): Document => {
  const hasName = model.username !== '';
  return {
    title: hasName ? `Welcome, ${model.username}!` : 'Welcome',
    body: div(
      [Class(styles.card)],
      [
        p(
          [Class(hasName ? styles.greeting : styles.empty)],
          [hasName ? `Welcome, ${model.username}!` : 'No name set yet.'],
        ),
        a([Class(styles.link), Href('/profile')], ['Set your name →']),
      ],
    ),
  };
};
