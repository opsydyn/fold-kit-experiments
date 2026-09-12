import { Schema } from 'effect';
import type { Return as UpdateReturn } from 'foldkit/update';

import { Message } from './message';
import type { Model } from './model';
import { Name } from './model';

const defaultName = Schema.decodeSync(Name)('World');

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    Reset: () => ({ model: { ...model, name: defaultName } }),
    SelectedLocale: ({ locale }) => ({ model: { ...model, locale } }),
  });
