import type { Html } from '@effect/ui/html';

import type { Message } from './message';
import type { Model } from './model';

import * as styles from './welcome.css';

export const view = (h: Html.H<Message>, { username }: Model) => {
  const hasName = username !== '';
  return h.div
    .class(styles.card)
    .children(
      h.p
        .class(hasName ? styles.greeting : styles.empty)
        .children(hasName ? `Welcome, ${username}!` : 'No name set yet.'),
      h.a.class(styles.link).attr('href', '/profile').children('Set your name →'),
    );
};
