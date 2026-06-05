import { Schema } from 'effect';
import { m } from 'foldkit/message';

export const Ticked = m('Ticked', { dt: Schema.Number });
export const HoveredBar = m('HoveredBar', { index: Schema.Number });
export const BlurredBar = m('BlurredBar', {});

export const Message = Schema.Union([Ticked, HoveredBar, BlurredBar]);
export type Message = typeof Message.Type;
