import { Subscription } from 'foldkit';

import { Message } from './message';
import type { Model } from './model';
import { Milliseconds } from './types';

export const subscriptions = Subscription.make<Model, Message>()((_entry) => ({
  frame: Subscription.animationFrame({
    isActive: (model) => model.particles.length > 0,
    toMessage: (deltaTimeMs) =>
      Message.TickedFrame({ deltaTimeMs: Milliseconds(deltaTimeMs) }),
  }),
}));
