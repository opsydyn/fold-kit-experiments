import { defineMessageUnion } from 'foldkit/message';

import { HueSchema, MillisecondsSchema, PixelsPerSecSchema, PixelsSchema } from './types';

export const Message = defineMessageUnion({
  ClickedDecrement: {},
  ClickedIncrement: {},
  ClickedReset: {},
  TickedFrame: { deltaTimeMs: MillisecondsSchema },
  SpawnedParticle: {
    x: PixelsSchema,
    y: PixelsSchema,
    vx: PixelsPerSecSchema,
    vy: PixelsPerSecSchema,
    hue: HueSchema,
    lifespanMs: MillisecondsSchema,
  },
});
export type Message = typeof Message.Type;
