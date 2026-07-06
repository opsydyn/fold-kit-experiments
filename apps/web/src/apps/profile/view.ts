import type { Document } from 'foldkit/html';
import { html } from 'foldkit/html';

import type { Message } from './message';
import { ClickedSave, UpdatedDraft } from './message';
import type { Model } from './model';
import * as styles from './profile.css';

const { div, p, input, button, label, a, Class, OnClick, OnInput, Value, Placeholder, Type, Href } =
  html<Message>();

export const view = (model: Model): Document => ({
  title: 'Profile',
  body: div(
    [Class(styles.card)],
    [
      div(
        [Class(styles.field)],
        [
          label([Class(styles.label)], ['Username']),
          input([
            Class(styles.input),
            Type('text'),
            Value(model.draft),
            Placeholder('Enter your name'),
            OnInput((value) => UpdatedDraft({ value })),
          ]),
        ],
      ),
      button([Class(styles.button), OnClick(ClickedSave())], ['Save']),
      ...(model.isSaved ? [p([Class(styles.saved)], ['Saved!'])] : []),
      a([Class(styles.link), Href('/welcome')], ['View welcome page →']),
    ],
  ),
});
