import type { Return as UpdateReturn } from 'foldkit/update';

import { SaveUsername } from './command';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    UpdatedDraft: ({ value }) => ({ model: { ...model, draft: value, isSaved: false } }),
    ClickedSave: () => ({
      model,
      commands: [SaveUsername({ username: model.draft })],
    }),
    CompletedSaveUsername: () => ({ model: { ...model, isSaved: true } }),
  });
