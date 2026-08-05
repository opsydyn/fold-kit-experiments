import { Match, Schema } from 'effect';

import type { Message } from './message';
import type { Model } from './model';
import { Name } from './model';

const defaultName = Schema.decodeSync(Name)('World');

type Return = readonly [Model, readonly []];

export const update = (model: Model, message: Message): Return =>
  Match.value(message).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      Reset: () => [{ ...model, name: defaultName }, []],
      SelectedLocale: ({ locale }) => [{ ...model, locale }, []],
    }),
  );
