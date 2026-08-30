import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as DensityContourMessage } from '../../ui/density-contour-chart';

export const Message = defineMessageUnion({
  GotDensityContourMessage: { message: Schema.Unknown },
});
export type GotDensityContourMessage = Omit<typeof Message.GotDensityContourMessage.Type, 'message'> & {
  readonly message: DensityContourMessage;
};
export type Message = typeof Message.Type;
