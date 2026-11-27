import { Message } from './message';
import type { Model } from './model';

export const update = (model: Model, message: Message): Model =>
  Message.match(message, {
    InspectedModule: ({ key }) => ({ ...model, inspected: key }),
    SelectedModule: ({ key }) => ({
      ...model,
      selected: model.selected === key ? null : key,
    }),
  });
