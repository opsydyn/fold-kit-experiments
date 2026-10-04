import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ZoomableLineMessage } from '../../ui/zoomable-line-chart';

export const Message = defineMessageUnion({
  ReceivedZoomableLineMessage: { message: Schema.Unknown },
});
export type ReceivedZoomableLineMessage = Omit<
  typeof Message.ReceivedZoomableLineMessage.Type,
  'message'
> & {
  readonly message: ZoomableLineMessage;
};
export type Message = typeof Message.Type;
