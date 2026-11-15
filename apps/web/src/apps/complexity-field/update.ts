import type { Return as UpdateReturn } from 'foldkit/update';

import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    InspectedModule: ({ key }) => ({ model: { ...model, inspected: key } }),
    SelectedModule: ({ key }) => ({
      model: { ...model, selected: model.selected === key ? null : key },
    }),
  });
