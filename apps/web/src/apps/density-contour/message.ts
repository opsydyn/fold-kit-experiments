import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as DensityContourMessage } from '../../ui/density-contour-chart';

export const GotDensityContourMessage = m('GotDensityContourMessage', { inner: Schema.Unknown });
export type GotDensityContourMessage = Omit<typeof GotDensityContourMessage.Type, 'inner'> & {
  readonly inner: DensityContourMessage;
};

export const Message = Schema.Union([GotDensityContourMessage]);
export type Message = typeof Message.Type;
