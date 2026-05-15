import { Schema } from 'effect'
import { Subscription } from 'foldkit'

import { TickedFrame } from './message'
import type { Message } from './message'
import type { Model } from './model'
import { Milliseconds } from './types'

export const subscriptions = Subscription.makeSubscriptions(
  Schema.Struct({ frame: Schema.Boolean }),
)<Model, Message>({
  frame: Subscription.animationFrame({
    isActive: model => model.particles.length > 0,
    toMessage: deltaTimeMs => TickedFrame({ deltaTimeMs: Milliseconds(deltaTimeMs) }),
  }),
})
