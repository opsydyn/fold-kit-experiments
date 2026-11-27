import type { Html } from '@effect/ui/html';

import { Message } from './message';
import type { Model } from './model';

import * as styles from './profile.css';

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class(styles.card).children(
    h.div.class(styles.field).children(
      h.label.class(styles.label).attr('for', 'profile-username').children('Username'),
      h.input
        .class(styles.input)
        .id('profile-username')
        .attrs({ type: 'text', placeholder: 'Enter your name' })
        .value(model.draft)
        .on('input', ({ value }) => Message.UpdatedDraft({ value })),
    ),
    h.button
      .class(styles.button)
      .attr('type', 'button')
      .on('click', Message.ClickedSave())
      .children('Save'),
    model.isSaved ? h.p.class(styles.saved).attr('role', 'status').children('Saved!') : undefined,
    h.a.class(styles.link).attr('href', '/welcome').children('View welcome page →'),
  );
