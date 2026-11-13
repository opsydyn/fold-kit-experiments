import type { Return as UpdateReturn } from 'foldkit/update';

import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    ChoseDownsampler: ({ downsampler }) => ({ model: { ...model, downsampler } }),
    ChoseFit: ({ fit }) => ({ model: { ...model, fit } }),
  });
