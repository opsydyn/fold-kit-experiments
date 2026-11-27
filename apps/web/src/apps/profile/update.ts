import type { Command } from '@effect/ui';

import { SaveUsername } from './command';
import { Message } from './message';
import type { Model } from './model';

interface Transition {
  readonly model: Model;
  readonly commands?: ReadonlyArray<Command.Command<Message>>;
}

export const update = (model: Model, message: Message): Transition =>
  Message.match(message, {
    RestoredUsername: ({ username }) => ({
      model: model.edited || username === '' ? model : { ...model, draft: username },
    }),
    UpdatedDraft: ({ value }) => ({
      model: { ...model, draft: value, edited: true, isSaved: false },
    }),
    ClickedSave: () => ({
      model: { ...model, edited: true },
      commands: [SaveUsername.make({ username: model.draft })],
    }),
    CompletedSaveUsername: ({ username }) => ({
      model: username === model.draft ? { ...model, isSaved: true } : model,
    }),
  });
