import { UiSchema } from '@effect/ui';

import { Downsampler, Fit } from './model';

export const Message = UiSchema.TaggedEnum({
  ChoseDownsampler: { downsampler: Downsampler },
  ChoseFit: { fit: Fit },
});
export type Message = typeof Message.Type;
