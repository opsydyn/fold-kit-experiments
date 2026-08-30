import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ZoomableLineMessage } from '../../ui/zoomable-line-chart';

export const Message = defineMessageUnion({
  GotZoomableLineMessage: { message: Schema.Unknown },
});
export type GotZoomableLineMessage = Omit<typeof Message.GotZoomableLineMessage.Type, 'message'> & {
  readonly message: ZoomableLineMessage;
};
export type Message = typeof Message.Type;
