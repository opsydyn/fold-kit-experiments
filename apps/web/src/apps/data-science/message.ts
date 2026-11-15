import { defineMessageUnion } from 'foldkit/message';

import { Downsampler, Fit } from './model';

export const Message = defineMessageUnion({
  ChoseDownsampler: { downsampler: Downsampler },
  ChoseFit: { fit: Fit },
});
export type Message = typeof Message.Type;
