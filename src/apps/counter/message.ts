import { Schema } from 'effect'
import { m } from 'foldkit/message'

import { HueSchema, MillisecondsSchema, PixelsPerSecSchema, PixelsSchema } from './types'

export const ClickedDecrement = m('ClickedDecrement')
export const ClickedIncrement = m('ClickedIncrement')
export const ClickedReset = m('ClickedReset')

export const TickedFrame = m('TickedFrame', { deltaTimeMs: MillisecondsSchema })

export const SpawnedParticle = m('SpawnedParticle', {
  x: PixelsSchema,
  y: PixelsSchema,
  vx: PixelsPerSecSchema,
  vy: PixelsPerSecSchema,
  hue: HueSchema,
  lifespanMs: MillisecondsSchema,
})

export const Message = Schema.Union([
  ClickedDecrement,
  ClickedIncrement,
  ClickedReset,
  TickedFrame,
  SpawnedParticle,
])
export type Message = typeof Message.Type
