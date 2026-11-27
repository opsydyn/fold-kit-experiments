import { Message } from './message';
import type { Model } from './model';

export const update = (model: Model, message: Message): Model =>
  Message.match(message, {
    ChoseDownsampler: ({ downsampler }) => ({ ...model, downsampler }),
    ChoseFit: ({ fit }) => ({ ...model, fit }),
  });
