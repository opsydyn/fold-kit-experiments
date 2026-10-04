import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as DensityContourMessage } from '../../ui/density-contour-chart';

export const Message = defineMessageUnion({
  ReceivedDensityContourMessage: { message: Schema.Unknown },
});
export type ReceivedDensityContourMessage = Omit<
  typeof Message.ReceivedDensityContourMessage.Type,
  'message'
> & {
  readonly message: DensityContourMessage;
};
export type Message = typeof Message.Type;
