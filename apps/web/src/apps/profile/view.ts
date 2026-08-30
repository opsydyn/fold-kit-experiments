import type { Document, HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import type { Model } from './model';

import * as styles from './profile.css';

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const {
    div,
    p,
    input,
    button,
    label,
    a,
    Class,
    OnClick,
    OnInput,
    Value,
    Placeholder,
    Type,
    Href,
  } = h;
  return {
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
              OnInput((value) => Message.UpdatedDraft({ value })),
            ]),
          ],
        ),
        button([Class(styles.button), OnClick(Message.ClickedSave())], ['Save']),
        ...(model.isSaved ? [p([Class(styles.saved)], ['Saved!'])] : []),
        a([Class(styles.link), Href('/welcome')], ['View welcome page →']),
      ],
    ),
  };
};
