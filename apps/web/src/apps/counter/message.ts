import { UiSchema } from '@effect/ui';

import { HueSchema, MillisecondsSchema, PixelsPerSecSchema, PixelsSchema } from './types';

export const Message = UiSchema.TaggedEnum({
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
