import { Match } from 'effect';

import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, message: Message): Return =>
  Match.value(message).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      Ticked: ({ deltaTimeMs }) => [{ ...model, elapsedMs: model.elapsedMs + deltaTimeMs }, []],
    }),
  );
