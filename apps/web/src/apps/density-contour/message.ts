import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as DensityContourMessage } from '../../ui/density-contour-chart';

export const GotDensityContourMessage = m('GotDensityContourMessage', { message: Schema.Unknown });
export type GotDensityContourMessage = Omit<typeof GotDensityContourMessage.Type, 'message'> & {
  readonly message: DensityContourMessage;
};

export const Message = Schema.Union([GotDensityContourMessage]);
export type Message = typeof Message.Type;
