import { Schema } from 'effect';

import { Message } from './message';
import type { Model } from './model';
import { Name } from './model';

const defaultName = Schema.decodeSync(Name)('World');

export const update = (model: Model, message: Message): Model =>
  Message.match(message, {
    Reset: () => ({ ...model, name: defaultName }),
    SelectedLocale: ({ locale }) => ({ ...model, locale }),
  });
