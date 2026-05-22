import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ZoomableLineMessage } from '../../ui/zoomable-line-chart';

export const GotZoomableLineMessage = m('GotZoomableLineMessage', { inner: Schema.Unknown });
export type GotZoomableLineMessage = Omit<typeof GotZoomableLineMessage.Type, 'inner'> & {
  readonly inner: ZoomableLineMessage;
};

export const Message = Schema.Union([GotZoomableLineMessage]);
export type Message = typeof Message.Type;
