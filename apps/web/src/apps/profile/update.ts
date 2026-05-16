import { Match } from 'effect';
import type { Command } from 'foldkit';

import { SaveUsername } from './command';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, ReadonlyArray<Command.Command<Message>>];

export const update = (model: Model, message: Message): Return =>
  Match.value(message).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      UpdatedDraft: ({ value }) => [{ ...model, draft: value, isSaved: false }, []],
      ClickedSave: () => [model, [SaveUsername({ username: model.draft })]],
      CompletedSaveUsername: () => [{ ...model, isSaved: true }, []],
    }),
  );
